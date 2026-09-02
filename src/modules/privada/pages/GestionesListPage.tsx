import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { gestionesApi } from '../api/gestiones.api'
import { GestionDetalleDrawer } from './GestionDetalleDrawer'
import { CambiarEstadoModal } from './CambiarEstadoModal'
import { AgregarGestionModal } from './AgregarGestionModal'
import { exportToXlsx } from '../../../shared/utils/exportTable'
import type { Gestion, GestionesResponse, CatalogoItem, MeResponse } from '../types/gestiones.types'

const PAGE_SIZE = 50

// ─── Definición de columnas de la tabla ──────────────────────────────────────
// `minimal` = set por defecto / botón "Min". Todas son toggleables y ordenables.
type ColKey =
  | 'fecha_ingreso' | 'nro_expediente' | 'estado' | 'urgencia' | 'departamento'
  | 'localidad' | 'ministerio' | 'categoria' | 'tipo_gestion' | 'canal_origen'
  | 'detalle' | 'costo_estimado' | 'dias_transcurridos' | 'id_gestion'

const COL_META: { key: ColKey; label: string; minimal: boolean }[] = [
  { key: 'fecha_ingreso', label: 'Fecha ingreso', minimal: true },
  { key: 'nro_expediente', label: 'Nro expediente', minimal: true },
  { key: 'estado', label: 'Estado', minimal: true },
  { key: 'urgencia', label: 'Urgencia', minimal: true },
  { key: 'departamento', label: 'Departamento', minimal: false },
  { key: 'localidad', label: 'Localidad', minimal: true },
  { key: 'ministerio', label: 'Ministerio', minimal: false },
  { key: 'categoria', label: 'Categoría', minimal: false },
  { key: 'tipo_gestion', label: 'Tipo', minimal: false },
  { key: 'canal_origen', label: 'Canal', minimal: false },
  { key: 'detalle', label: 'Detalle', minimal: true },
  { key: 'costo_estimado', label: 'Costo', minimal: false },
  { key: 'dias_transcurridos', label: 'Días', minimal: false },
  { key: 'id_gestion', label: 'ID', minimal: false },
]
const MINIMAL_COLS = COL_META.filter((c) => c.minimal).map((c) => c.key)
const LS_COLS_KEY = 'privada.gestiones.cols.v1'

// El backend ordena por estas claves (whitelist en service._SORT_COLS de svc-privada).
// `detalle` / `id_gestion` no tienen orden server-side → fallback client-side sobre la página.
const SORT_SERVER: ReadonlySet<ColKey> = new Set<ColKey>([
  'fecha_ingreso', 'estado', 'urgencia', 'departamento', 'localidad',
  'nro_expediente', 'costo_estimado', 'dias_transcurridos',
  'ministerio', 'categoria', 'tipo_gestion', 'canal_origen',
])

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
  const [okGob, setOkGob] = useState('')
  const [okMin, setOkMin] = useState('')
  const [offset, setOffset] = useState(0)

  // UI
  const [drawerGestionId, setDrawerGestionId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ id: string; estadoActual: string; nroExpediente?: string | null } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showAgregar, setShowAgregar] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showCols, setShowCols] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [sort, setSort] = useState<{ key: ColKey; dir: 'asc' | 'desc' } | null>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    try {
      const raw = localStorage.getItem(LS_COLS_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as ColKey[]
        const valid = arr.filter((k) => COL_META.some((c) => c.key === k))
        if (valid.length) return new Set(valid)
      }
    } catch { /* localStorage no disponible */ }
    return new Set(MINIMAL_COLS)
  })

  function persistCols(next: Set<ColKey>) {
    setVisibleCols(next)
    try { localStorage.setItem(LS_COLS_KEY, JSON.stringify([...next])) } catch { /* noop */ }
  }
  function toggleCol(key: ColKey) {
    const next = new Set(visibleCols)
    if (next.has(key)) next.delete(key); else next.add(key)
    if (next.size === 0) return
    persistCols(next)
  }
  function toggleSort(key: ColKey) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setOffset(0)
  }

  const hasFilters = !!(q || estado || ministerio || categoria || tipoGestion || canalOrigen || departamento || localidad || okGob || okMin)

  function resetFilters() {
    setQ(''); setQInput(''); setEstado('')
    setMinisterio(''); setCategoria(''); setTipoGestion(''); setCanalOrigen('')
    setDepartamento(''); setLocalidad(''); setOkGob(''); setOkMin(''); setOffset(0)
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

  const sortServer = sort && SORT_SERVER.has(sort.key) ? sort : null

  // ── Listado de gestiones ───────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<GestionesResponse>({
    queryKey: ['gestiones', q, estado, ministerio, categoria, tipoGestion, canalOrigen, departamento, localidad, okGob, okMin, offset, sortServer?.key, sortServer?.dir],
    queryFn: () => gestionesApi.list({
      q: q || undefined,
      estado: estado || undefined,
      ministerio: ministerio || undefined,
      categoria: categoria || undefined,
      tipo_gestion: tipoGestion || undefined,
      canal_origen: canalOrigen || undefined,
      departamento: departamento || undefined,
      localidad: localidad || undefined,
      ok_gobernador: okGob || undefined,
      ok_ministro: okMin || undefined,
      sort: sortServer?.key,
      sort_dir: sortServer?.dir,
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

  function copyText(text: string, tag: string) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(tag)
        window.setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1500)
      },
      () => { /* clipboard bloqueado — sin feedback */ },
    )
  }

  const nombreDe = useCallback(
    (lista: CatalogoItem[] | undefined, id?: string | null) =>
      (id ? lista?.find((x) => x.id === id)?.nombre : undefined) ?? id ?? '',
    [],
  )

  // Texto plano de una celda — usado para ordenar y para exportar
  const cellText = useCallback((g: Gestion, key: ColKey): string => {
    switch (key) {
      case 'fecha_ingreso': return g.fecha_ingreso ?? ''
      case 'nro_expediente': return g.nro_expediente ?? ''
      case 'estado': return g.estado_nombre ?? g.estado ?? ''
      case 'urgencia': return g.urgencia ?? ''
      case 'departamento': return g.departamento ?? ''
      case 'localidad': return g.localidad ?? ''
      case 'ministerio': return nombreDe(ministerios, g.ministerio_agencia_id)
      case 'categoria': return nombreDe(categorias, g.categoria_general_id)
      case 'tipo_gestion': return nombreDe(tiposGestion, g.tipo_gestion)
      case 'canal_origen': return nombreDe(canalesOrigen, g.canal_origen)
      case 'detalle': return g.detalle ?? ''
      case 'costo_estimado': return g.costo_estimado != null ? String(g.costo_estimado) : ''
      case 'dias_transcurridos': return g.dias_transcurridos != null ? String(g.dias_transcurridos) : ''
      case 'id_gestion': return g.id_gestion
    }
  }, [ministerios, categorias, tiposGestion, canalesOrigen, nombreDe])

  const sortedItems = useMemo(() => {
    // orden server-side ya aplicado → no re-ordenar en el cliente
    if (!sort || SORT_SERVER.has(sort.key)) return items
    const num = sort.key === 'costo_estimado' || sort.key === 'dias_transcurridos'
    const copy = [...items]
    copy.sort((a, b) => {
      const va = cellText(a, sort.key)
      const vb = cellText(b, sort.key)
      let c: number
      if (num) c = (parseFloat(va) || 0) - (parseFloat(vb) || 0)
      else c = va.localeCompare(vb, 'es', { sensitivity: 'base' })
      return sort.dir === 'asc' ? c : -c
    })
    return copy
  }, [items, sort, cellText])

  async function fetchAllFiltered(): Promise<Gestion[]> {
    const filtros = {
      q: q || undefined,
      estado: estado || undefined,
      ministerio: ministerio || undefined,
      categoria: categoria || undefined,
      tipo_gestion: tipoGestion || undefined,
      canal_origen: canalOrigen || undefined,
      departamento: departamento || undefined,
      localidad: localidad || undefined,
      ok_gobernador: okGob || undefined,
      ok_ministro: okMin || undefined,
    }
    const LIMIT = 200
    const all: Gestion[] = []
    let off = 0
    for (;;) {
      const page: GestionesResponse = await gestionesApi.list({ ...filtros, limit: LIMIT, offset: off })
      const rows = page.items ?? []
      all.push(...rows)
      const tot = page.total ?? all.length
      if (rows.length < LIMIT || all.length >= tot) break
      off += LIMIT
    }
    return all
  }

  function baseFilename() {
    const hoy = new Date().toISOString().slice(0, 10)
    const slug = (s: string) => s.replace(/\s+/g, '-')
    return `gestiones_${departamento ? slug(departamento) : 'todos'}${localidad ? '_' + slug(localidad) : ''}_${hoy}`
  }

  async function handleExportExcel() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllFiltered()
      if (all.length === 0) { setExportError('No hay gestiones que coincidan con los filtros aplicados.'); return }
      const mapped = all.map((g) => ({
        'ID': g.id_gestion,
        'Departamento': g.departamento ?? '',
        'Localidad': g.localidad ?? '',
        'Estado': g.estado_nombre ?? g.estado ?? '',
        'Urgencia': g.urgencia ?? '',
        'Ministerio/Agencia': nombreDe(ministerios, g.ministerio_agencia_id),
        'Categoría': nombreDe(categorias, g.categoria_general_id),
        'Tipo de gestión': nombreDe(tiposGestion, g.tipo_gestion),
        'Canal de origen': nombreDe(canalesOrigen, g.canal_origen),
        'Detalle': g.detalle ?? '',
        'Nro. Expediente': g.nro_expediente ?? '',
        'Costo estimado': g.costo_estimado ?? '',
        'Moneda': g.costo_moneda ?? '',
        'Fecha ingreso': g.fecha_ingreso ?? '',
        'Días transcurridos': g.dias_transcurridos ?? '',
      }))
      exportToXlsx(mapped, 'Gestiones', `${baseFilename()}.xlsx`)
    } catch {
      setExportError('No se pudo exportar. Intentá de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPdf() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllFiltered()
      if (all.length === 0) { setExportError('No hay gestiones que coincidan con los filtros aplicados.'); return }
      const partes: string[] = []
      if (departamento) partes.push(`Departamento: ${departamento}`)
      if (localidad) partes.push(`Localidad: ${localidad}`)
      if (estado) partes.push(`Estado: ${nombreDe(estados, estado)}`)
      if (ministerio) partes.push(`Ministerio: ${nombreDe(ministerios, ministerio)}`)
      if (categoria) partes.push(`Categoría: ${nombreDe(categorias, categoria)}`)
      if (tipoGestion) partes.push(`Tipo: ${nombreDe(tiposGestion, tipoGestion)}`)
      if (canalOrigen) partes.push(`Canal: ${nombreDe(canalesOrigen, canalOrigen)}`)
      if (q) partes.push(`Búsqueda: "${q}"`)
      const filtroTexto = partes.length ? partes.join('  |  ') : 'Sin filtros (todos los registros)'

      const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const autoTable = autoTableMod.default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(13)
      doc.text('Gestiones del Ministro', 40, 36)
      doc.setFontSize(9)
      doc.text(`Exportado: ${new Date().toLocaleString('es-AR')}`, 40, 52)
      doc.text(`Filtros: ${filtroTexto}`, 40, 65)
      doc.text(`Total: ${all.length}`, 40, 78)

      autoTable(doc, {
        startY: 90,
        styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [23, 44, 63] },
        columnStyles: { 9: { cellWidth: 200 } },
        head: [['Fecha', 'Nro exp.', 'Estado', 'Urgencia', 'Departamento', 'Localidad', 'Ministerio', 'Categoría', 'Tipo', 'Detalle', 'Días']],
        body: all.map((g) => [
          g.fecha_ingreso ?? '',
          g.nro_expediente ?? '',
          g.estado_nombre ?? g.estado ?? '',
          g.urgencia ?? '',
          g.departamento ?? '',
          g.localidad ?? '',
          nombreDe(ministerios, g.ministerio_agencia_id),
          nombreDe(categorias, g.categoria_general_id),
          nombreDe(tiposGestion, g.tipo_gestion),
          g.detalle ?? '',
          g.dias_transcurridos != null ? String(g.dias_transcurridos) : '',
        ]),
      })
      doc.save(`${baseFilename()}.pdf`)
    } catch {
      setExportError('No se pudo exportar a PDF. Intentá de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  const orderedVisibleCols = COL_META.filter((c) => visibleCols.has(c.key))

  function renderCell(g: Gestion, key: ColKey) {
    switch (key) {
      case 'fecha_ingreso':
        return <time className="text-slate-600" dateTime={g.fecha_ingreso}>{formatFecha(g.fecha_ingreso)}</time>
      case 'nro_expediente':
        return g.nro_expediente ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-xs text-slate-600 font-mono">{g.nro_expediente}</span>
            <button type="button" onClick={() => copyText(g.nro_expediente!, `exp:${g.id_gestion}`)}
              title="Copiar nro de expediente" aria-label="Copiar nro de expediente"
              className="text-slate-400 hover:text-gov-blue transition-colors">
              {copied === `exp:${g.id_gestion}` ? <span className="text-xs text-green-600">✓</span> : <span aria-hidden="true">📋</span>}
            </button>
          </span>
        ) : <span className="text-slate-300">—</span>
      case 'estado':
        return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(g.estado)}`}>{g.estado_nombre ?? g.estado}</span>
      case 'urgencia':
        return g.urgencia
          ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${urgenciaBadge(g.urgencia)}`}>{g.urgencia}</span>
          : <span className="text-slate-300">—</span>
      case 'localidad':
        return (
          <>
            <p className="text-sm font-medium text-slate-700">{g.localidad}</p>
            <p className="text-xs text-slate-400">{g.departamento}</p>
          </>
        )
      case 'detalle':
        return <p className="truncate max-w-xs text-slate-700" title={g.detalle}>{g.detalle}</p>
      case 'id_gestion':
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-mono">{g.id_gestion.slice(0, 8)}…</span>
            <button type="button" onClick={() => copyText(g.id_gestion, `id:${g.id_gestion}`)}
              title="Copiar ID" aria-label="Copiar ID" className="text-slate-400 hover:text-gov-blue transition-colors">
              {copied === `id:${g.id_gestion}` ? <span className="text-xs text-green-600">✓</span> : <span aria-hidden="true">⧉</span>}
            </button>
          </span>
        )
      case 'costo_estimado':
        return <span className="text-slate-600">{g.costo_estimado != null ? `${g.costo_estimado.toLocaleString('es-AR')}${g.costo_moneda ? ' ' + g.costo_moneda : ''}` : '—'}</span>
      case 'dias_transcurridos':
        return <span className="text-slate-600">{g.dias_transcurridos ?? '—'}</span>
      default:
        return <span className="text-slate-600">{cellText(g, key) || '—'}</span>
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Gestiones del Ministro</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total} gestión${total !== 1 ? 'es' : ''} registrada${total !== 1 ? 's' : ''}` : ' '}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="flex gap-2">
            {/* Selector de columnas */}
            <div className="relative">
              <button
                onClick={() => { setShowCols((v) => !v); setShowExportMenu(false) }}
                className="border border-slate-300 text-slate-600 px-3 py-2 rounded text-sm hover:bg-slate-50 transition-colors"
                aria-haspopup="true" aria-expanded={showCols}
              >
                Columnas
              </button>
              {showCols && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCols(false)} aria-hidden="true" />
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2" role="menu">
                    <div className="flex gap-1 mb-2">
                      <button className="flex-1 text-xs border border-slate-200 rounded py-1 hover:bg-slate-50"
                        onClick={() => persistCols(new Set(MINIMAL_COLS))}>Min</button>
                      <button className="flex-1 text-xs border border-slate-200 rounded py-1 hover:bg-slate-50"
                        onClick={() => persistCols(new Set(COL_META.map((c) => c.key)))}>Todo</button>
                      <button className="flex-1 text-xs border border-slate-200 rounded py-1 hover:bg-slate-50"
                        onClick={() => persistCols(new Set(MINIMAL_COLS))}>Reset</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {COL_META.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 px-1 py-1 text-sm text-slate-700 hover:bg-slate-50 rounded cursor-pointer">
                          <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 px-1">Se guarda en este navegador.</p>
                  </div>
                </>
              )}
            </div>

            {/* Exportar */}
            <div className="relative">
              <button
                onClick={() => { setShowExportMenu((v) => !v); setShowCols(false) }}
                disabled={exporting}
                className="border border-slate-300 text-slate-600 px-3 py-2 rounded text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-haspopup="true" aria-expanded={showExportMenu}
              >
                {exporting ? 'Exportando…' : `↓ Exportar${total > 0 ? ` (${total})` : ''} ▾`}
              </button>
              {showExportMenu && !exporting && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} aria-hidden="true" />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1" role="menu">
                    <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => { setShowExportMenu(false); handleExportExcel() }}>Excel (.xlsx)</button>
                    <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => { setShowExportMenu(false); handleExportPdf() }}>PDF</button>
                  </div>
                </>
              )}
            </div>

            {canModify && (
              <button
                onClick={() => setShowAgregar(true)}
                className="bg-gov-navy text-white px-4 py-2 rounded text-sm hover:bg-gov-blue transition-colors"
              >
                + Nueva gestión
              </button>
            )}
          </div>
          {exportError && <p role="alert" className="text-xs text-red-600">{exportError}</p>}
        </div>
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
          <FilterSelect
            id="f-okgob" label="Ok Gobernador"
            value={okGob} onChange={handleFilterChange(setOkGob)}
            options={['SI', 'NO', 'PENDIENTE']}
          />
          <FilterSelect
            id="f-okmin" label="Ok Ministro"
            value={okMin} onChange={handleFilterChange(setOkMin)}
            options={['SI', 'NO', 'PENDIENTE']}
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
                {orderedVisibleCols.map((c) => (
                  <th key={c.key} scope="col" className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-white/80"
                      title={SORT_SERVER.has(c.key)
                        ? 'Ordenar por esta columna (todo el listado)'
                        : 'Ordenar por esta columna (sólo la página visible)'}
                    >
                      {c.label}
                      <span className="text-[10px] opacity-70">
                        {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={orderedVisibleCols.length + 1} className="px-4 py-8 text-center text-slate-400" role="status">
                    Cargando gestiones…
                  </td>
                </tr>
              )}
              {!isLoading && sortedItems.length === 0 && (
                <tr>
                  <td colSpan={orderedVisibleCols.length + 1} className="px-4 py-8 text-center text-slate-400">
                    No se encontraron gestiones con los filtros aplicados.
                  </td>
                </tr>
              )}
              {sortedItems.map((g) => (
                <tr key={g.id_gestion} className="hover:bg-slate-50 transition-colors align-top">
                  {orderedVisibleCols.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.key === 'detalle' ? 'max-w-xs' : 'whitespace-nowrap'}`}>
                      {renderCell(g, c.key)}
                    </td>
                  ))}
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

      {/* ── Modal nueva gestión ── */}
      <AgregarGestionModal
        open={showAgregar}
        onClose={() => setShowAgregar(false)}
        onCreated={(id) => setDrawerGestionId(id)}
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
