import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { gestionesApi } from '../api/gestiones.api'
import { GestionDetalleDrawer } from './GestionDetalleDrawer'
import { CambiarEstadoModal } from './CambiarEstadoModal'
import type { GestionesResponse, CatalogoItem, MeResponse } from '../types/gestiones.types'

const PAGE_SIZE = 50

// ─── Helpers de estilo ────────────────────────────────────────────────────────

function urgenciaBadge(urgencia?: string) {
  const u = (urgencia ?? '').toLowerCase()
  if (u === 'alta') return 'bg-red-100 text-red-700'
  if (u === 'media') return 'bg-yellow-100 text-yellow-700'
  if (u === 'baja') return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-500'
}

function estadoBadge(estado: string) {
  const e = estado.toUpperCase()
  if (e === 'INGRESADO') return 'bg-blue-100 text-blue-700'
  if (e === 'FINALIZADA') return 'bg-green-100 text-green-700'
  if (e === 'ARCHIVADO') return 'bg-gray-100 text-gray-500'
  if (e === 'DERIVADO A SUAC') return 'bg-indigo-100 text-indigo-700'
  if (e === 'LISTA PARA INNAUGURAR') return 'bg-teal-100 text-teal-700'
  if (e === 'NO REMITE SUAC') return 'bg-orange-100 text-orange-700'
  return 'bg-slate-100 text-slate-600'
}

function formatFecha(fecha?: string) {
  if (!fecha) return '—'
  try {
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return fecha }
}

// ─── Componente de confirmación de eliminación ────────────────────────────────

function DeleteConfirmModal({ id, onCancel, onConfirm, isPending, error }: {
  id: string; onCancel: () => void; onConfirm: () => void; isPending: boolean; error?: string | null
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-sm pointer-events-auto"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-2">Eliminar gestión</h2>
            <p className="text-sm text-slate-600 mb-1">
              Esta acción realizará un borrado lógico de la gestión.
            </p>
            <p className="text-xs text-slate-400 font-mono mb-5">{id}</p>
            {error && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Select de filtro reutilizable ───────────────────────────────────────────

function FilterSelect({ id, label, value, onChange, options, nameKey = 'nombre', valueKey = 'id' }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  options: CatalogoItem[] | string[]; nameKey?: string; valueKey?: string
}) {
  const isStrings = options.length > 0 && typeof options[0] === 'string'
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-xs text-slate-500 font-medium">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan bg-white"
      >
        <option value="">Todos</option>
        {isStrings
          ? (options as string[]).map((o) => <option key={o} value={o}>{o}</option>)
          : (options as CatalogoItem[]).map((o) => (
              <option key={(o as any)[valueKey]} value={(o as any)[valueKey]}>
                {(o as any)[nameKey]}
              </option>
            ))
        }
      </select>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function GestionesListPage() {
  const qc = useQueryClient()

  // Filtros
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [estado, setEstado] = useState('')
  const [ministerio, setMinisterio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tipoGestion, setTipoGestion] = useState('')
  const [canalOrigen, setCanalOrigen] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [offset, setOffset] = useState(0)

  // UI
  const [drawerGestionId, setDrawerGestionId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ id: string; estadoActual: string; nroExpediente?: string | null } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const hasFilters = !!(q || estado || ministerio || categoria || tipoGestion || canalOrigen || departamento || localidad)

  function resetFilters() {
    setQ(''); setQInput(''); setEstado('')
    setMinisterio(''); setCategoria(''); setTipoGestion(''); setCanalOrigen('')
    setDepartamento(''); setLocalidad(''); setOffset(0)
  }

  function handleFilterChange<T>(setter: (v: T) => void, resetLocalidad = false) {
    return (v: T) => {
      setter(v)
      setOffset(0)
      if (resetLocalidad) setLocalidad('')
    }
  }

  // ── Catálogos ──────────────────────────────────────────────────────────────
  const { data: estados } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-estados'],
    queryFn: () => gestionesApi.catalogo('estados'),
    staleTime: Infinity,
  })
  const { data: ministerios } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-ministerios'],
    queryFn: () => gestionesApi.catalogo('ministerios'),
    staleTime: Infinity,
  })
  const { data: categorias } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-categorias'],
    queryFn: () => gestionesApi.catalogo('categorias'),
    staleTime: Infinity,
  })
  const { data: tiposGestion } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-tipos-gestion'],
    queryFn: () => gestionesApi.catalogo('tipos-gestion'),
    staleTime: Infinity,
  })
  const { data: canalesOrigen } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-canales-origen'],
    queryFn: () => gestionesApi.catalogo('canales-origen'),
    staleTime: Infinity,
  })
  const { data: departamentos } = useQuery<string[]>({
    queryKey: ['privada-cat-departamentos'],
    queryFn: () => gestionesApi.catalogo('departamentos'),
    staleTime: Infinity,
  })
  const { data: localidades } = useQuery<string[]>({
    queryKey: ['privada-cat-localidades', departamento],
    queryFn: () => gestionesApi.catalogoLocalidades(departamento),
    enabled: !!departamento,
    staleTime: Infinity,
  })
  const { data: me } = useQuery<MeResponse>({
    queryKey: ['privada-me'],
    queryFn: () => gestionesApi.me(),
    staleTime: Infinity,
  })

  // ── Listado de gestiones ───────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<GestionesResponse>({
    queryKey: ['gestiones', q, estado, ministerio, categoria, tipoGestion, canalOrigen, departamento, localidad, offset],
    queryFn: () => gestionesApi.list({
      q: q || undefined,
      estado: estado || undefined,
      ministerio: ministerio || undefined,
      categoria: categoria || undefined,
      tipo_gestion: tipoGestion || undefined,
      canal_origen: canalOrigen || undefined,
      departamento: departamento || undefined,
      localidad: localidad || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    placeholderData: keepPreviousData,
  })

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => gestionesApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gestiones'] })
      setDeleteId(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail
        : (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string')
          ? (detail as { message: string }).message
          : 'Error al eliminar la gestión.'
      setDeleteError(msg)
    },
  })

  const canDelete = me?.rol === 'Admin' || me?.rol === 'Supervisor'
  const canModify = me?.rol === 'Admin' || me?.rol === 'Supervisor' || me?.rol === 'Operador'

  const total = data?.total ?? 0
  const items = data?.items ?? []
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  const handleCambiarEstado = useCallback((id: string, estadoActual: string, nroExpediente?: string | null) => {
    setModal({ id, estadoActual, nroExpediente })
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gov-navy">Gestiones del Ministro</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {total > 0 ? `${total} gestión${total !== 1 ? 'es' : ''} registrada${total !== 1 ? 's' : ''}` : ' '}
        </p>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
        {/* Búsqueda libre */}
        <form
          onSubmit={(e) => { e.preventDefault(); setQ(qInput); setOffset(0) }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar por localidad, dirección, detalle…"
            className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
          />
          <button
            type="submit"
            className="bg-gov-navy text-white px-4 py-2 rounded text-sm hover:bg-gov-blue transition-colors"
          >
            Buscar
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="border border-slate-200 text-slate-500 px-3 py-2 rounded text-sm hover:bg-slate-50 transition-colors"
            >
              Limpiar
            </button>
          )}
        </form>

        {/* Estado pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setEstado(''); setOffset(0) }}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              !estado ? 'bg-gov-navy text-white border-gov-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos
          </button>
          {(estados ?? []).map((e) => (
            <button
              key={e.id}
              onClick={() => { setEstado(estado === e.id ? '' : e.id); setOffset(0) }}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                estado === e.id ? 'bg-gov-navy text-white border-gov-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        {/* Selects de filtro */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <FilterSelect
            id="f-ministerio" label="Ministerio"
            value={ministerio} onChange={handleFilterChange(setMinisterio)}
            options={ministerios ?? []}
          />
          <FilterSelect
            id="f-categoria" label="Categoría"
            value={categoria} onChange={handleFilterChange(setCategoria)}
            options={categorias ?? []}
          />
          <FilterSelect
            id="f-tipo" label="Tipo de gestión"
            value={tipoGestion} onChange={handleFilterChange(setTipoGestion)}
            options={tiposGestion ?? []}
          />
          <FilterSelect
            id="f-canal" label="Canal origen"
            value={canalOrigen} onChange={handleFilterChange(setCanalOrigen)}
            options={canalesOrigen ?? []}
          />
          <FilterSelect
            id="f-depto" label="Departamento"
            value={departamento} onChange={handleFilterChange(setDepartamento, true)}
            options={(departamentos ?? []).map((d) => ({ id: d, nombre: d }))}
          />
          <FilterSelect
            id="f-localidad" label="Localidad"
            value={localidad} onChange={handleFilterChange(setLocalidad)}
            options={(localidades ?? []).map((l) => ({ id: l, nombre: l }))}
          />
        </div>
      </div>

      {/* ── Tabla ── */}
      {isError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 mb-4">
          Error al cargar las gestiones. Verificá tu conexión o volvé a intentarlo.
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" role="region" aria-label="Listado de gestiones">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gov-navy text-white">
                {['Fecha / Expediente', 'Estado', 'Urgencia', 'Localidad', 'Detalle', 'Acciones'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400" role="status">
                    Cargando gestiones…
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No se encontraron gestiones con los filtros aplicados.
                  </td>
                </tr>
              )}
              {items.map((g) => (
                <tr key={g.id_gestion} className="hover:bg-slate-50 transition-colors">
                  {/* Fecha / Expediente */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <time className="text-slate-600 text-sm" dateTime={g.fecha_ingreso}>
                      {formatFecha(g.fecha_ingreso)}
                    </time>
                    {g.nro_expediente && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{g.nro_expediente}</p>
                    )}
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(g.estado)}`}>
                      {g.estado_nombre ?? g.estado}
                    </span>
                  </td>

                  {/* Urgencia */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {g.urgencia && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${urgenciaBadge(g.urgencia)}`}>
                        {g.urgencia}
                      </span>
                    )}
                  </td>

                  {/* Localidad / Departamento */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm font-medium text-slate-700">{g.localidad}</p>
                    <p className="text-xs text-slate-400">{g.departamento}</p>
                  </td>

                  {/* Detalle */}
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-slate-700" title={g.detalle}>{g.detalle}</p>
                    {(g.ministerio_nombre || g.categoria_nombre) && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {[g.ministerio_nombre, g.categoria_nombre].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDrawerGestionId(g.id_gestion)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Ver
                      </button>
                      {canModify && (
                        <button
                          onClick={() => handleCambiarEstado(g.id_gestion, g.estado, g.nro_expediente)}
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Modificar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => { setDeleteId(g.id_gestion); setDeleteError(null) }}
                          className="px-2.5 py-1 text-xs border border-red-200 rounded text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Página {currentPage} de {pageCount} — {total} resultado{total !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer de detalle ── */}
      <GestionDetalleDrawer
        gestionId={drawerGestionId}
        canModify={canModify}
        onClose={() => setDrawerGestionId(null)}
        onCambiarEstado={(id, estadoActual, nroExpediente) => {
          handleCambiarEstado(id, estadoActual, nroExpediente)
        }}
      />

      {/* ── Modal cambiar estado ── */}
      {modal && (
        <CambiarEstadoModal
          gestionId={modal.id}
          estadoActual={modal.estadoActual}
          nroExpedienteActual={modal.nroExpediente}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Confirmación de eliminación ── */}
      {deleteId && (
        <DeleteConfirmModal
          id={deleteId}
          onCancel={() => { setDeleteId(null); setDeleteError(null) }}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          isPending={deleteMutation.isPending}
          error={deleteError}
        />
      )}
    </div>
  )
}
