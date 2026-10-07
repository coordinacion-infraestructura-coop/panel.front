import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { geoPendientesApi } from '../api/geoPendientes.api'
import { cordonCunetaApi } from '../../vivienda/api/vivienda.api'
import { normalizeDepartamento } from '../../../shared/utils/normalizeName'
import type {
  AlcanceAlias,
  EstadoPendiente,
  GeoPendiente,
  ResolverPendienteOut,
} from '../types/geoPendientes.types'

// Spec: docs/files/spec-geo-asignacion-manual-localidades.md

const ORIGEN_LABEL: Record<string, string> = {
  cordon_cuneta: 'Cordón Cuneta',
  cordoba_hogar: 'Córdoba Hogar',
  mi_lugar: 'Mi Lugar',
  gas_pit: 'Gasífera',
  atp: 'ATP',
  privada: 'Privada',
  datos_externos: 'Datos externos',
}

const PROGRAMA_LABEL: Record<string, string> = {
  cordon_cuneta: 'Cordón Cuneta',
  cordoba_hogar: 'Córdoba Hogar',
  mi_lugar: 'Mi Lugar',
}

const ESTADOS: { value: EstadoPendiente; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'resuelta', label: 'Resueltas' },
  { value: 'descartada', label: 'Descartadas' },
]

function errMsg(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'Sólo un Admin puede vincular localidades.'
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in (detail as Record<string, unknown>)) {
    return String((detail as Record<string, unknown>).message)
  }
  return 'No se pudo completar la operación. Reintentá en unos segundos.'
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type Accion = { tipo: 'vincular' | 'sin_vinculo'; pendiente: GeoPendiente }

function ResolverModal({
  accion,
  onClose,
  onResuelto,
}: {
  accion: Accion
  onClose: () => void
  onResuelto: (r: ResolverPendienteOut) => void
}) {
  const { pendiente, tipo } = accion
  const vincular = tipo === 'vincular'
  const { data: geo = [], isLoading: cargandoGeo } = useQuery({
    queryKey: ['geo-localidades'],
    queryFn: cordonCunetaApi.getGeo,
    staleTime: 60 * 60 * 1000,
    enabled: vincular,
  })
  const activas = useMemo(() => geo.filter((g) => g.activo), [geo])
  const departamentos = useMemo(
    () => [...new Set(activas.map((g) => g.departamento))].sort((a, b) => a.localeCompare(b, 'es')),
    [activas],
  )

  // undefined = todavía no eligió; se preselecciona el departamento de la fila.
  const [departamentoElegido, setDepartamentoElegido] = useState<string>()
  const departamento =
    departamentoElegido ??
    departamentos.find((d) => normalizeDepartamento(d) === normalizeDepartamento(pendiente.departamento)) ??
    ''
  const [idGeo, setIdGeo] = useState('')
  const [alcance, setAlcance] = useState<AlcanceAlias>('departamento')
  const [motivo, setMotivo] = useState('')
  const [impacto, setImpacto] = useState<ResolverPendienteOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  const localidades = useMemo(
    () =>
      activas
        .filter((g) => g.departamento === departamento)
        .sort((a, b) => a.localidad.localeCompare(b.localidad, 'es')),
    [activas, departamento],
  )

  const resolver = useMutation({
    mutationFn: (dryRun: boolean) =>
      geoPendientesApi.resolver(pendiente.id, {
        id_geo: vincular ? idGeo : null,
        alcance,
        motivo: motivo.trim(),
        dry_run: dryRun,
      }),
    onSuccess: (r) => {
      setError(null)
      if (r.dry_run) setImpacto(r)
      else onResuelto(r)
    },
    onError: (err) => setError(errMsg(err)),
  })

  const formularioCompleto = motivo.trim().length >= 3 && (!vincular || idGeo !== '')
  const editarDeshabilitado = impacto !== null || resolver.isPending

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolver-titulo"
        className="bg-white rounded-lg shadow-xl w-full max-w-xl my-8"
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 id="resolver-titulo" className="text-base font-semibold text-gov-navy">
            {vincular ? 'Vincular a una localidad del padrón' : 'Confirmar sin vínculo'}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium">{pendiente.localidad}</span>
            {pendiente.departamento ? ` (${pendiente.departamento})` : ''} ·{' '}
            {ORIGEN_LABEL[pendiente.origen] ?? pendiente.origen}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!vincular && (
            <p className="text-sm text-slate-600">
              Usalo cuando el nombre no corresponde a ninguna localidad del padrón (un barrio, un
              paraje). Deja de figurar como pendiente y no se vincula con nada.
            </p>
          )}

          {vincular && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">
                Departamento
                <select
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm disabled:bg-slate-50"
                  value={departamento}
                  disabled={editarDeshabilitado || cargandoGeo}
                  onChange={(e) => {
                    setDepartamentoElegido(e.target.value)
                    setIdGeo('')
                  }}
                >
                  <option value="">{cargandoGeo ? 'Cargando…' : 'Elegí un departamento'}</option>
                  {departamentos.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Localidad del padrón
                <select
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm disabled:bg-slate-50"
                  value={idGeo}
                  disabled={editarDeshabilitado || !departamento}
                  onChange={(e) => setIdGeo(e.target.value)}
                >
                  <option value="">Elegí una localidad</option>
                  {localidades.map((g) => (
                    <option key={g.id_geo} value={g.id_geo}>{g.localidad}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <fieldset disabled={editarDeshabilitado} className="text-sm text-slate-700">
            <legend className="mb-1">Aplicar a</legend>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                className="mt-1"
                checked={alcance === 'departamento'}
                onChange={() => setAlcance('departamento')}
              />
              <span>
                Sólo este nombre en {pendiente.departamento || 'este departamento'}
                <span className="block text-xs text-slate-500">
                  Recomendado: hay localidades con el mismo nombre en departamentos distintos.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 mt-1.5 cursor-pointer">
              <input
                type="radio"
                className="mt-1"
                checked={alcance === 'global'}
                onChange={() => setAlcance('global')}
              />
              <span>Este nombre en cualquier departamento</span>
            </label>
          </fieldset>

          <label className="block text-sm text-slate-700">
            Motivo
            <input
              type="text"
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm disabled:bg-slate-50"
              placeholder={vincular ? 'Ej.: abreviatura, error de tipeo' : 'Ej.: barrio de Córdoba Capital'}
              value={motivo}
              maxLength={500}
              disabled={editarDeshabilitado}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>

          {impacto && (
            <div className="border border-slate-200 rounded bg-slate-50 px-3 py-2.5 text-sm text-slate-700 space-y-2">
              <p className="font-medium text-gov-navy">Qué va a cambiar</p>
              {impacto.registros.length === 0 ? (
                <p>Ningún registro de Cordón Cuneta, Córdoba Hogar ni Mi Lugar.</p>
              ) : (
                <ul className="space-y-1">
                  {impacto.registros.map((r) => (
                    <li key={`${r.programa}-${r.id}`}>
                      {PROGRAMA_LABEL[r.programa]}: {r.nombre_actual}
                      {r.departamento_actual ? ` (${r.departamento_actual})` : ''}
                      {r.nombre_oficial
                        ? ` → ${r.nombre_oficial} (${r.departamento_oficial})`
                        : ' → queda sin vínculo, confirmado'}
                    </li>
                  ))}
                </ul>
              )}
              <p>
                {impacto.pendientes_resueltos === 1
                  ? 'Se cierra 1 pendiente.'
                  : `Se cierran ${impacto.pendientes_resueltos} pendientes (el mismo nombre en otras fuentes).`}
              </p>
              {vincular && (
                <p className="text-slate-500">
                  Gasífera y ATP toman el vínculo en su próxima sincronización (hasta 1 hora).
                </p>
              )}
              {impacto.avisos.map((a) => (
                <p key={a} className="text-amber-700">{a}</p>
              ))}
            </div>
          )}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={impacto ? () => setImpacto(null) : onClose}
            disabled={resolver.isPending}
            className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
          >
            {impacto ? 'Volver' : 'Cancelar'}
          </button>
          <button
            onClick={() => resolver.mutate(impacto === null)}
            disabled={!formularioCompleto || resolver.isPending}
            className="bg-gov-navy text-white text-sm px-4 py-1.5 rounded hover:bg-gov-navy/90 disabled:opacity-40"
          >
            {resolver.isPending
              ? '…'
              : impacto === null
                ? 'Revisar cambios'
                : vincular
                  ? 'Vincular'
                  : 'Confirmar sin vínculo'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LocalidadesSinResolverPage() {
  const qc = useQueryClient()
  const [estado, setEstado] = useState<EstadoPendiente>('pendiente')
  const [origen, setOrigen] = useState('')
  const [accion, setAccion] = useState<Accion | null>(null)
  const [avisos, setAvisos] = useState<{ titulo: string; detalle: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['geo-pendientes', estado, origen],
    queryFn: () => geoPendientesApi.list({ estado, origen: origen || undefined, limit: 200 }),
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['geo-pendientes'] })

  const descartar = useMutation({
    mutationFn: (id: string) => geoPendientesApi.descartar(id),
    onSuccess: () => {
      setError(null)
      invalidar()
    },
    onError: (err) => setError(errMsg(err)),
  })
  const deshacer = useMutation({
    mutationFn: (id: string) => geoPendientesApi.deshacer(id),
    onSuccess: (r) => {
      setError(null)
      setAvisos({
        titulo: `Vínculo deshecho. ${r.registros_restaurados} registro(s) de Vivienda restaurado(s).`,
        detalle: r.avisos,
      })
      invalidar()
    },
    onError: (err) => setError(errMsg(err)),
  })

  const items = data?.items ?? []
  const ocupado = descartar.isPending || deshacer.isPending

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Localidades sin resolver</h2>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Nombres de localidad que alguna fuente cargó y no coinciden con el padrón oficial.
            Vinculá cada uno a su localidad, o confirmá que no corresponde a ninguna.
          </p>
        </div>
        <Link
          to="/admin/usuarios"
          className="text-sm text-gov-navy border border-gray-200 px-4 py-2 rounded hover:bg-slate-50 transition-colors"
        >
          Usuarios
        </Link>
      </div>

      {avisos && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2.5 flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{avisos.titulo}</p>
            {avisos.detalle.map((a) => (
              <p key={a} className="mt-0.5">{a}</p>
            ))}
          </div>
          <button aria-label="Cerrar" className="text-green-500 hover:text-green-700" onClick={() => setAvisos(null)}>✕</button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-center justify-between">
          {error}
          <button aria-label="Cerrar" className="text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Estado">
          {ESTADOS.map((e) => (
            <button
              key={e.value}
              role="tab"
              aria-selected={estado === e.value}
              onClick={() => setEstado(e.value)}
              className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                estado === e.value
                  ? 'bg-gov-navy text-white border-gov-navy'
                  : 'border-slate-300 text-slate-600 hover:border-gov-cyan hover:text-gov-blue'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Fuente
          <select
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(ORIGEN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
        {isError ? (
          <div role="alert" className="p-8 text-center text-sm text-red-700 bg-red-50">
            No se pudo cargar la lista. Reintentá en unos segundos.
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {estado === 'pendiente'
              ? 'No hay localidades sin resolver.'
              : estado === 'resuelta'
                ? 'Todavía no se resolvió ninguna desde esta pantalla.'
                : 'No hay localidades descartadas.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Localidad</th>
                <th className="px-4 py-2 font-medium">Departamento</th>
                <th className="px-4 py-2 font-medium">Fuente</th>
                <th className="px-4 py-2 font-medium text-right">Registros</th>
                {estado === 'resuelta' ? (
                  <th className="px-4 py-2 font-medium">Vinculada a</th>
                ) : (
                  <th className="px-4 py-2 font-medium">Vista</th>
                )}
                <th className="px-4 py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-medium text-gov-navy">{p.localidad}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.departamento ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{ORIGEN_LABEL[p.origen] ?? p.origen}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{p.cantidad ?? '—'}</td>
                  {estado === 'resuelta' ? (
                    <td className="px-4 py-2.5 text-slate-600">
                      {p.alias?.id_geo
                        ? `${p.alias.localidad_oficial} (${p.alias.departamento_oficial})`
                        : 'Confirmada sin vínculo'}
                      <span className="block text-xs text-slate-400">
                        {p.alias?.motivo}
                        {p.resuelta_by ? ` · ${p.resuelta_by}` : ''}
                        {p.resuelta_at ? ` · ${fecha(p.resuelta_at)}` : ''}
                      </span>
                    </td>
                  ) : (
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      {fecha(p.ultima_vez)}
                      <span className="block text-xs text-slate-400">desde {fecha(p.primera_vez)}</span>
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-3 whitespace-nowrap">
                      {estado === 'resuelta' ? (
                        <button
                          disabled={ocupado}
                          onClick={() => {
                            if (window.confirm(`¿Deshacer el vínculo de "${p.localidad}"? Vuelve a quedar pendiente.`)) {
                              deshacer.mutate(p.id)
                            }
                          }}
                          className="text-gov-blue hover:underline disabled:opacity-50"
                        >
                          Deshacer
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={ocupado}
                            onClick={() => setAccion({ tipo: 'vincular', pendiente: p })}
                            className="text-gov-blue font-medium hover:underline disabled:opacity-50"
                          >
                            Vincular
                          </button>
                          <button
                            disabled={ocupado}
                            onClick={() => setAccion({ tipo: 'sin_vinculo', pendiente: p })}
                            className="text-gov-blue hover:underline disabled:opacity-50"
                          >
                            Sin vínculo
                          </button>
                          {estado === 'pendiente' && (
                            <button
                              disabled={ocupado}
                              onClick={() => descartar.mutate(p.id)}
                              className="text-slate-500 hover:underline disabled:opacity-50"
                            >
                              Descartar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && data.total > items.length && (
        <p className="mt-2 text-xs text-slate-500">
          Mostrando {items.length} de {data.total}. Filtrá por fuente para ver el resto.
        </p>
      )}

      {accion && (
        <ResolverModal
          key={`${accion.tipo}-${accion.pendiente.id}`}
          accion={accion}
          onClose={() => setAccion(null)}
          onResuelto={(r) => {
            setAccion(null)
            setAvisos({
              titulo: r.id_geo
                ? `Vinculada a ${r.localidad_oficial} (${r.departamento_oficial}). ${r.registros.length} registro(s) de Vivienda actualizado(s).`
                : 'Confirmada sin vínculo.',
              detalle: r.avisos,
            })
            invalidar()
          }}
        />
      )}
    </div>
  )
}
