import { useState, useMemo, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { miLugarApi } from '../api/vivienda.api'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import { MapaDualPuntos } from '../../../shared/components/informe/MapaDualPuntos'
import type {
  EstadoML, ProyectoML, ProyectoMLUpdate, ProyectoMLCreate,
  EstadoHistorialML, PedidoML, TipoProyectoML, ConfigML,
  EstadoMLCreate, EstadoMLUpdate, GeoPuntoMLCreate, GeoLocalidad, PuntoInforme,
} from '../types/vivienda.types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonto(n: number | null) {
  if (!n) return '—'
  return '$' + Number(n).toLocaleString('es-AR')
}
function fmtMontoResumen(n: number) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  return '$' + (n / 1e6).toFixed(1) + 'M'
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function extractErrorMessage(err: unknown, fallback: string) {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'No tenés permisos para realizar esta acción.'
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (status === 409) return 'Este registro está en uso y no puede eliminarse.'
  if (Array.isArray(detail)) {
    return detail
      .map((e: { loc?: string[]; msg?: string }) => {
        const field = e.loc?.slice(-1)[0] ?? ''
        return field ? `El campo "${field}" es requerido o contiene un valor inválido.` : (e.msg ?? 'Error de validación.')
      })
      .join(' ')
  }
  if (detail) return JSON.stringify(detail)
  return fallback
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoProyectoML, { label: string; color: string }> = {
  exp:  { label: 'Expropiaciones',       color: '#B03A2E' },
  muni: { label: 'Convenios Municipios', color: '#1E8449' },
  prov: { label: 'Lotes Provinciales',   color: '#1A5276' },
}

const CAMPO_LABELS: Record<string, string> = {
  ejuridico:  'Jurídico',
  etecnico:   'Técnico',
  efinanciero:'Presupuestario',
}

// ── Sticky column styles ──────────────────────────────────────────────────────

const S1_HEAD = { position: 'sticky' as const, left: 0, zIndex: 3, background: '#101f2d', minWidth: 36, width: 36 }
const S2_HEAD = { position: 'sticky' as const, left: 36, zIndex: 3, background: 'var(--color-gov-navy)', minWidth: 170 }
const S1_BODY = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#f8fafc', minWidth: 36, width: 36 }
const S2_BODY = { position: 'sticky' as const, left: 36, zIndex: 2, background: '#f8fafc', minWidth: 170, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)' }

// ── avance ────────────────────────────────────────────────────────────────────

function avancePct(p: ProyectoML, estados: EstadoML[]) {
  const tipoEstados = estados.filter((e) => e.tipo === p.tipo)
  const maxPos = Math.max(tipoEstados.length - 1, 1)
  const pos = (id: number | null) => {
    if (!id) return 0
    const i = tipoEstados.findIndex((e) => e.id === id)
    return i < 0 ? 0 : i
  }
  return Math.round(((pos(p.ejuridico) + pos(p.etecnico) + pos(p.efinanciero)) / (maxPos * 3)) * 100)
}
function avanceColor(pct: number) {
  if (pct === 0) return '#94a3b8'
  if (pct < 40) return '#f59e0b'
  if (pct < 80) return 'var(--color-gov-blue)'
  return '#22c55e'
}

function estadoLabel(id: number | null, estados: EstadoML[]): string {
  return estados.find((e) => e.id === id)?.label ?? '—'
}

function exportXlsx(proyectos: ProyectoML[], estados: EstadoML[], tipo: TipoProyectoML) {
  const tipoEstados = estados.filter((e) => e.tipo === tipo)
  const rows = proyectos.map((p, i) => ({
    '#': i + 1,
    'Nombre': p.nombre,
    'Localidad': p.localidad_nombre,
    'Departamento': p.departamento ?? '',
    'Expediente': p.expediente ?? '',
    'Responsable': p.responsable ?? '',
    'Superficie (Ha)': p.superficie ?? '',
    'Lotes': p.lotes ?? '',
    'Monto ($)': p.monto ?? '',
    'Valor Fiscal ($)': p.valor_fiscal ?? '',
    'INFRA s/Nexos ($)': p.infra_sin_nexos ?? '',
    'Costo Nexos ($)': p.costo_nexos ?? '',
    'Convenio UNC ($)': p.convenio_unc ?? '',
    'Costo Total Infra ($)': p.costo_total_infra ?? '',
    'E. Jurídico': estadoLabel(p.ejuridico, tipoEstados),
    'E. Técnico': estadoLabel(p.etecnico, tipoEstados),
    'E. Presup.': estadoLabel(p.efinanciero, tipoEstados),
    'E. General': estadoLabel(p.estado_general, tipoEstados),
    'Avance (%)': avancePct(p, tipoEstados),
    'OK Gobernación': p.ok_gob,
    'Coordenadas': p.geo_puntos.map((g) => `${g.lat},${g.lng}`).join(' | '),
    'Observaciones': p.obs ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, TIPO_CONFIG[tipo].label.slice(0, 31))
  XLSX.writeFile(wb, `mi-lugar-${tipo}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const IconClipboard = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)
const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)
const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
const IconChevronRight = () => (
  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

// ── EstadoBadge ───────────────────────────────────────────────────────────────

function EstadoBadge({ id, estados }: { id: number | null; estados: EstadoML[] }) {
  const e = estados.find((s) => s.id === id)
  if (!e) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: e.bg, color: e.text_color }}>
      {e.label}
    </span>
  )
}

// ── GeoLinks ──────────────────────────────────────────────────────────────────

function GeoLinks({ puntos }: { puntos: ProyectoML['geo_puntos'] }) {
  if (!puntos.length) return <span className="text-gray-300">—</span>
  return (
    <span className="flex flex-col gap-0.5">
      {puntos.map((p, i) => (
        <a key={p.id}
          href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
          target="_blank" rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs whitespace-nowrap">
          📍 {puntos.length === 1 ? 'Ver mapa' : `Pto. ${i + 1}`}
        </a>
      ))}
    </span>
  )
}

// ── Historial de estados tab ───────────────────────────────────────────────────

function HistorialEstadosTab({ proyectoId, estados }: { proyectoId: string; estados: EstadoML[] }) {
  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['ml-historial', proyectoId],
    queryFn: () => miLugarApi.getHistorial(proyectoId),
  })
  if (isLoading) return <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
  if (!historial.length) return (
    <p className="text-sm text-gray-400 text-center py-8">Sin cambios de estado registrados.</p>
  )
  return (
    <ol className="space-y-3 px-5 py-4">
      {historial.map((h: EstadoHistorialML, i: number) => (
        <li key={h.id} className="flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
              style={{ background: i === 0 ? 'var(--color-gov-cyan)' : '#bae6fd' }} />
            {i < historial.length - 1 && <div className="w-px flex-1 mt-1 bg-slate-200" />}
          </div>
          <div className="pb-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold text-gov-navy uppercase tracking-wide">
                {CAMPO_LABELS[h.campo] ?? h.campo}
              </span>
              {h.created_by && <span className="text-xs text-gray-400">· {h.created_by.split('@')[0]}</span>}
              <time className="text-xs text-gray-400 ml-auto">{fmtTs(h.created_at)}</time>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {h.estado_anterior_id
                ? <EstadoBadge id={h.estado_anterior_id} estados={estados} />
                : <span className="text-gray-300 text-xs">Sin estado</span>}
              <IconChevronRight />
              <EstadoBadge id={h.estado_nuevo_id} estados={estados} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ── Panel de detalle ──────────────────────────────────────────────────────────

function DetailPanel({
  proyecto, estados, onClose,
}: {
  proyecto: ProyectoML; estados: EstadoML[]; onClose: () => void
}) {
  const uid = useId()
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState<'comunicaciones' | 'historial'>('comunicaciones')
  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState('')
  const [fecha, setFecha] = useState(today)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: panelUser } = usePortalUser()
  const canWritePedidos = ['Admin', 'Supervisor', 'Operador'].includes(panelUser?.rol ?? '')
    || (panelUser?.secretarias ?? []).includes('infraestructura')
    || (panelUser?.secretarias ?? []).includes('supervision')

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['ml-pedidos', proyecto.id],
    queryFn: () => miLugarApi.getPedidos(proyecto.id),
  })

  const createMut = useMutation({
    mutationFn: (d: { descripcion: string; fecha_pedido: string }) =>
      miLugarApi.createPedido(proyecto.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-pedidos', proyecto.id] })
      setDesc(''); setFecha(today); setShowForm(false); setSaveError(null)
    },
    onError: (err: unknown) => setSaveError(extractErrorMessage(err, 'Error al guardar.')),
  })

  const deleteMut = useMutation({
    mutationFn: (pedidoId: string) => miLugarApi.deletePedido(proyecto.id, pedidoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-pedidos', proyecto.id] })
      setConfirmDelete(null); setDeleteError(null)
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err, 'Error al eliminar.')),
  })

  const tabCls = (t: typeof tab) =>
    `flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${tab === t
      ? 'border-gov-cyan text-gov-cyan'
      : 'border-transparent text-gray-500 hover:text-gray-700'}`

  const tipoLabel = TIPO_CONFIG[proyecto.tipo].label

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
        <div className="px-5 py-4 flex items-start justify-between border-b border-slate-200" style={{ background: 'var(--color-gov-navy)' }}>
          <div>
            <div className="text-[10px] font-semibold tracking-widest mb-0.5 text-gov-cyan uppercase">Mi Lugar — {tipoLabel}</div>
            <h3 id={`${uid}-t`} className="text-white font-semibold text-sm">{proyecto.nombre}</h3>
            {proyecto.localidad_nombre && <p className="text-xs mt-0.5 text-white/60 uppercase">{proyecto.localidad_nombre}{proyecto.departamento ? ` · ${proyecto.departamento}` : ''}</p>}
          </div>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none ml-4 mt-0.5 transition-colors" aria-label="Cerrar">✕</button>
        </div>
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button className={tabCls('comunicaciones')} onClick={() => setTab('comunicaciones')}>Comunicaciones</button>
          <button className={tabCls('historial')} onClick={() => setTab('historial')}>Cambios de estado</button>
        </div>

        {tab === 'comunicaciones' && (
          <>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              {!showForm ? (
                canWritePedidos && (
                  <button onClick={() => setShowForm(true)} className="w-full text-sm font-medium py-2 rounded border-2 border-dashed border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors">
                    + Nueva actualización
                  </button>
                )
              ) : (
                <div className="space-y-2">
                  <label htmlFor={`${uid}-desc`} className="block text-xs font-bold uppercase text-gray-500">¿Qué se solicitó / comunicó?</label>
                  <textarea id={`${uid}-desc`} rows={3} autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describí el pedido o comunicación..." className="w-full border border-sky-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
                  <div className="flex items-center gap-2">
                    <label htmlFor={`${uid}-fecha`} className="text-xs font-bold uppercase text-gray-500 flex-shrink-0">Fecha *</label>
                    <input id={`${uid}-fecha`} type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="border border-sky-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
                  </div>
                  {saveError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{saveError}</p>}
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => { setShowForm(false); setDesc(''); setFecha(today); setSaveError(null) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button onClick={() => { if (desc.trim() && fecha) createMut.mutate({ descripcion: desc.trim(), fecha_pedido: fecha }) }} disabled={createMut.isPending || !desc.trim() || !fecha} className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 transition-colors hover:opacity-90" style={{ background: 'var(--color-gov-navy)' }}>
                      {createMut.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
              {isLoading && <p role="status" className="text-sm text-gray-400 text-center py-8">Cargando...</p>}
              {!isLoading && !pedidos.length && <p className="text-sm text-gray-400 text-center py-8">Sin comunicaciones registradas aún.</p>}
              <ol className="space-y-3">
                {pedidos.map((p: PedidoML, i: number) => (
                  <li key={p.id} className="flex gap-3 group">
                    <div className="flex flex-col items-center" aria-hidden="true">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: i === 0 ? 'var(--color-gov-cyan)' : '#bae6fd' }} />
                      {i < pedidos.length - 1 && <div className="w-px flex-1 mt-1 bg-slate-200" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <time className="text-xs font-semibold text-gov-navy" dateTime={p.fecha_pedido}>
                          {new Date(p.fecha_pedido + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </time>
                        <span className="text-xs text-gray-600">{p.created_by_nombre ?? p.created_by?.split('@')[0] ?? ''}</span>
                        {p.secretaria === 'infraestructura' && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">Infraestructura</span>}
                        {p.secretaria === 'supervision' && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">Supervisión</span>}
                        <button onClick={() => setConfirmDelete(p.id)} className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all focus-visible:opacity-100" aria-label="Eliminar" title="Eliminar">
                          <IconTrash />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 leading-snug">{p.descripcion}</p>
                      {confirmDelete === p.id && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-700 flex-1">¿Eliminar esta actualización?</span>
                            <button onClick={() => deleteMut.mutate(p.id)} disabled={deleteMut.isPending} className="px-2.5 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 transition-colors">{deleteMut.isPending ? '...' : 'Sí, eliminar'}</button>
                            <button onClick={() => { setConfirmDelete(null); setDeleteError(null) }} className="px-2.5 py-1 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                          </div>
                          {deleteError && <p role="alert" className="text-xs text-red-700 mt-1.5">{deleteError}</p>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {tab === 'historial' && (
          <div className="flex-1 overflow-y-auto">
            <HistorialEstadosTab proyectoId={proyecto.id} estados={estados} />
          </div>
        )}
      </div>
    </>
  )
}

// ── Modal de edición ──────────────────────────────────────────────────────────

function EditModal({
  proyecto, estados, config, onSave, onClose, isSaving, saveError,
}: {
  proyecto: ProyectoML; estados: EstadoML[]; config: ConfigML | null
  onSave: (data: ProyectoMLUpdate) => void; onClose: () => void
  isSaving: boolean; saveError?: string | null
}) {
  const uid = useId()
  const today = new Date().toISOString().split('T')[0]
  const lotesPorHa = Number(config?.lotes_por_ha ?? 25)
  const montoPorLoteMuni = config?.monto_por_lote_muni != null ? Number(config.monto_por_lote_muni) : null
  const [deptoGeo, setDeptoGeo] = useState(proyecto.departamento ?? '')

  const geoQuery = useQuery({ queryKey: ['ml-geo'], queryFn: miLugarApi.getGeo, staleTime: 15 * 60_000 })
  const geoData: GeoLocalidad[] = geoQuery.data ?? []
  const deptosGeo = useMemo(() => [...new Set(geoData.map((g) => g.departamento))].sort(), [geoData])
  const localidadesFiltradas = useMemo(
    () => geoData.filter((g) => !deptoGeo || g.departamento === deptoGeo),
    [geoData, deptoGeo]
  )

  const [form, setForm] = useState<ProyectoMLUpdate>({
    nombre: proyecto.nombre,
    localidad_nombre: proyecto.localidad_nombre,
    departamento: proyecto.departamento,
    expediente: proyecto.expediente ?? '',
    responsable: proyecto.responsable ?? '',
    superficie: proyecto.superficie,
    lotes: proyecto.lotes,
    monto: proyecto.monto,
    valor_fiscal: proyecto.valor_fiscal,
    infra_sin_nexos: proyecto.infra_sin_nexos,
    costo_nexos: proyecto.costo_nexos,
    convenio_unc: proyecto.convenio_unc,
    costo_total_infra: proyecto.costo_total_infra,
    ok_gob: proyecto.ok_gob,
    ejuridico: proyecto.ejuridico,
    etecnico: proyecto.etecnico,
    efinanciero: proyecto.efinanciero,
    estado_general: proyecto.estado_general,
    obs: proyecto.obs ?? '',
    fecha_cambio: today,
    geo_puntos: proyecto.geo_puntos.map((p) => ({ lat: p.lat, lng: p.lng })),
  })
  const [geoText, setGeoText] = useState(proyecto.geo_puntos.map((p) => `${p.lat},${p.lng}`).join('\n'))

  const set = <K extends keyof ProyectoMLUpdate>(k: K, v: ProyectoMLUpdate[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const calcLotesAuto = form.superficie != null ? Math.round(Number(form.superficie) * lotesPorHa) : null
  const lotesMatchAuto = calcLotesAuto != null && form.lotes === calcLotesAuto

  const lbl = 'block text-xs font-bold text-gray-500 uppercase mb-1'
  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'
  const tieneFinanciero = proyecto.tipo === 'exp' || proyecto.tipo === 'prov'

  function parseGeoText(text: string): GeoPuntoMLCreate[] {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [lat, lng] = l.split(',').map((s) => parseFloat(s.trim()))
      return isNaN(lat) || isNaN(lng) ? null : { lat, lng }
    }).filter((p): p is GeoPuntoMLCreate => p !== null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={onClose}>
      <div className="bg-white rounded-lg w-[760px] max-w-[97vw] max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">Editar — {proyecto.nombre}</h3>
          <button type="button" onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor={`${uid}-nom`} className={lbl}>Nombre / Denominación *</label>
              <input id={`${uid}-nom`} className={inp} value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${uid}-dep`} className={lbl}>Departamento</label>
              <select id={`${uid}-dep`} className={inp} value={deptoGeo}
                onChange={(e) => { setDeptoGeo(e.target.value); set('departamento', e.target.value || null); set('localidad_nombre', null); set('localidad_id', null) }}>
                <option value="">— Seleccionar —</option>
                {deptosGeo.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-loc`} className={lbl}>Localidad *</label>
              <select id={`${uid}-loc`} className={inp}
                value={geoData.find((g) => g.localidad === form.localidad_nombre && g.departamento === deptoGeo)?.id_geo ?? ''}
                onChange={(e) => {
                  const loc = geoData.find((g) => g.id_geo === e.target.value)
                  if (!loc) return
                  set('localidad_id', loc.id_geo)
                  set('localidad_nombre', loc.localidad)
                  set('departamento', loc.departamento)
                  setDeptoGeo(loc.departamento)
                }}>
                <option value="">— Seleccionar —</option>
                {localidadesFiltradas.map((g) => <option key={g.id_geo} value={g.id_geo}>{g.localidad.toUpperCase()}</option>)}
              </select>
              {form.localidad_nombre && <p className="text-xs text-gray-500 mt-0.5">Actual: <b className="uppercase">{form.localidad_nombre}</b></p>}
            </div>
            <div>
              <label htmlFor={`${uid}-exp`} className={lbl}>Expediente</label>
              <input id={`${uid}-exp`} className={inp + ' font-mono'} value={form.expediente ?? ''} onChange={(e) => set('expediente', e.target.value || null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-res`} className={lbl}>Responsable</label>
              <input id={`${uid}-res`} className={inp} value={form.responsable ?? ''} onChange={(e) => set('responsable', e.target.value || null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-okgob`} className={lbl}>OK Gobernación</label>
              <select id={`${uid}-okgob`} className={inp} value={form.ok_gob ?? 'SI'} onChange={(e) => set('ok_gob', e.target.value)}>
                <option>SI</option><option>NO</option><option>PENDIENTE</option>
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-obs`} className={lbl}>Observaciones</label>
              <textarea id={`${uid}-obs`} className={inp} rows={2} value={form.obs ?? ''} onChange={(e) => set('obs', e.target.value || null)} />
            </div>
          </div>

          {/* Superficie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-sup`} className={lbl}>Superficie (Ha)</label>
              <input id={`${uid}-sup`} type="number" step="0.0001" className={inp}
                value={form.superficie ?? ''} onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value)
                  set('superficie', v)
                  if (v != null) set('lotes', Math.round(v * lotesPorHa))
                }} />
            </div>
            <div>
              <label htmlFor={`${uid}-lot`} className={lbl}>
                Lotes
                {lotesMatchAuto && <span className="ml-2 text-[10px] text-cyan-600 font-medium normal-case">= {form.superficie} Ha × {lotesPorHa}</span>}
              </label>
              <input id={`${uid}-lot`} type="number" className={inp}
                value={form.lotes ?? ''} onChange={(e) => {
                  const v = e.target.value === '' ? null : parseInt(e.target.value)
                  set('lotes', v)
                  if (proyecto.tipo === 'muni' && v != null && montoPorLoteMuni != null) {
                    set('monto', v * montoPorLoteMuni)
                  }
                }} />
            </div>
          </div>

          {/* Financiero */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-monto`} className={lbl}>
                Monto ($)
                {proyecto.tipo === 'muni' && form.lotes != null && montoPorLoteMuni != null && (
                  <span className="ml-2 text-[10px] text-cyan-600 font-medium normal-case">= {form.lotes} lotes × ${montoPorLoteMuni.toLocaleString('es-AR')}</span>
                )}
              </label>
              <input id={`${uid}-monto`} type="number" className={inp} value={form.monto ?? ''} onChange={(e) => set('monto', e.target.value === '' ? null : parseFloat(e.target.value))} />
            </div>
            {tieneFinanciero && <>
              {proyecto.tipo === 'exp' && (
                <div>
                  <label htmlFor={`${uid}-vf`} className={lbl}>Valor Fiscal ($)</label>
                  <input id={`${uid}-vf`} type="number" className={inp} value={form.valor_fiscal ?? ''} onChange={(e) => set('valor_fiscal', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
              )}
              <div>
                <label htmlFor={`${uid}-isn`} className={lbl}>INFRA SIN NEXOS ($)</label>
                <input id={`${uid}-isn`} type="number" className={inp} value={form.infra_sin_nexos ?? ''} onChange={(e) => set('infra_sin_nexos', e.target.value === '' ? null : parseFloat(e.target.value))} />
              </div>
              <div>
                <label htmlFor={`${uid}-nex`} className={lbl}>Costo NEXOS ($)</label>
                <input id={`${uid}-nex`} type="number" className={inp} value={form.costo_nexos ?? ''} onChange={(e) => set('costo_nexos', e.target.value === '' ? null : parseFloat(e.target.value))} />
              </div>
              <div>
                <label htmlFor={`${uid}-unc`} className={lbl}>Convenio UNC ($)</label>
                <input id={`${uid}-unc`} type="number" className={inp} value={form.convenio_unc ?? ''} onChange={(e) => set('convenio_unc', e.target.value === '' ? null : parseFloat(e.target.value))} />
              </div>
              <div>
                <label htmlFor={`${uid}-cti`} className={lbl}>COSTO TOTAL INFRA ($)</label>
                <input id={`${uid}-cti`} type="number" className={inp} value={form.costo_total_infra ?? ''} onChange={(e) => set('costo_total_infra', e.target.value === '' ? null : parseFloat(e.target.value))} />
              </div>
            </>}
          </div>

          {/* Estados por dimensión */}
          <div>
            <div className="flex items-end gap-4 mb-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gov-navy">Estados por Dimensión</p>
              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor={`${uid}-fcambio`} className="text-xs text-gray-500 whitespace-nowrap">Fecha del cambio:</label>
                <input id={`${uid}-fcambio`} type="date" max={today}
                  className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                  value={form.fecha_cambio ?? today} onChange={(e) => set('fecha_cambio', e.target.value || today)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['ejuridico', 'etecnico', 'efinanciero'] as const).map((field) => (
                <div key={field} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <label htmlFor={`${uid}-${field}`} className="block text-xs font-bold uppercase mb-2 text-gov-navy">
                    {CAMPO_LABELS[field]}
                  </label>
                  <select id={`${uid}-${field}`}
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                    value={form[field] ?? ''}
                    onChange={(e) => set(field, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {estados
                      .filter((e) => field === 'ejuridico' ? e.aplica_juridico : field === 'etecnico' ? e.aplica_tecnico : e.aplica_financiero)
                      .map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3">
              <label htmlFor={`${uid}-eg`} className="block text-xs font-bold uppercase mb-2 text-amber-800">Estado General</label>
              <select id={`${uid}-eg`}
                className="w-full border border-amber-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                value={form.estado_general ?? ''}
                onChange={(e) => set('estado_general', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Sin estado —</option>
                {estados.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
          </div>

          {/* Geolocalización */}
          <div>
            <label htmlFor={`${uid}-geo`} className={lbl}>Geolocalización — una coordenada por línea (lat,lng)</label>
            <textarea id={`${uid}-geo`} className={inp + ' font-mono text-xs'} rows={3}
              value={geoText} onChange={(e) => setGeoText(e.target.value)}
              placeholder={'-31.292807,-64.177675\n-31.289985,-64.179777'} />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {saveError
            ? <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex-1">{saveError}</p>
            : <span />}
          <div className="flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-sm border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" disabled={isSaving || !form.nombre?.trim()}
              onClick={() => onSave({ ...form, geo_puntos: parseGeoText(geoText) })}
              className="px-5 py-1.5 rounded text-sm text-white disabled:opacity-50 transition-colors hover:opacity-90"
              style={{ background: 'var(--color-gov-navy)' }}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de alta ─────────────────────────────────────────────────────────────

function AgregarProyectoModal({
  tipo, config, onClose,
}: {
  tipo: TipoProyectoML; config: ConfigML | null
  onClose: () => void
}) {
  const uid = useId()
  const qc = useQueryClient()
  const lotesPorHa = Number(config?.lotes_por_ha ?? 25)
  const montoPorLoteMuni = config?.monto_por_lote_muni != null ? Number(config.monto_por_lote_muni) : null
  const [form, setForm] = useState<Partial<ProyectoMLCreate>>({
    tipo, nombre: '', localidad_nombre: '', ok_gob: 'SI',
  })
  const [geoText, setGeoText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deptoGeo, setDeptoGeo] = useState('')

  const geoQuery = useQuery({ queryKey: ['ml-geo'], queryFn: miLugarApi.getGeo, staleTime: 15 * 60_000 })
  const geoData: GeoLocalidad[] = geoQuery.data ?? []
  const deptosGeo = useMemo(() => [...new Set(geoData.map((g) => g.departamento))].sort(), [geoData])
  const localidadesFiltradas = useMemo(
    () => geoData.filter((g) => !deptoGeo || g.departamento === deptoGeo),
    [geoData, deptoGeo]
  )

  function selectLocalidad(idGeo: string) {
    const loc = geoData.find((g) => g.id_geo === idGeo)
    if (!loc) return
    setForm((p) => ({
      ...p,
      localidad_id: loc.id_geo,
      localidad_nombre: loc.localidad,
      departamento: loc.departamento,
    }))
    setDeptoGeo(loc.departamento)
  }

  const createMut = useMutation({
    mutationFn: (data: ProyectoMLCreate) => miLugarApi.createProyecto(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-proyectos', tipo] })
      onClose()
    },
    onError: (err: unknown) => setSaveError(extractErrorMessage(err, 'Error al crear el proyecto.')),
  })

  const set = <K extends keyof ProyectoMLCreate>(k: K, v: ProyectoMLCreate[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const calcLotesAuto = form.superficie != null ? Math.round(Number(form.superficie) * lotesPorHa) : null
  const lotesMatchAuto = calcLotesAuto != null && form.lotes === calcLotesAuto

  const lbl = 'block text-xs font-bold text-gray-500 uppercase mb-1'
  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'
  const tieneFinanciero = tipo === 'exp' || tipo === 'prov'

  function parseGeoText(text: string) {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [lat, lng] = l.split(',').map((s) => parseFloat(s.trim()))
      return isNaN(lat) || isNaN(lng) ? null : { lat, lng }
    }).filter((p): p is { lat: number; lng: number } => p !== null)
  }

  function handleSubmit() {
    const nombre = (form.nombre ?? '').trim()
    const localidad_nombre = (form.localidad_nombre ?? '').trim()
    if (!nombre || !localidad_nombre) return
    createMut.mutate({
      tipo: form.tipo ?? tipo,
      nombre,
      localidad_nombre,
      departamento: form.departamento || undefined,
      expediente: form.expediente || undefined,
      responsable: form.responsable || undefined,
      superficie: form.superficie,
      lotes: form.lotes,
      monto: form.monto,
      valor_fiscal: form.valor_fiscal,
      infra_sin_nexos: form.infra_sin_nexos,
      costo_nexos: form.costo_nexos,
      convenio_unc: form.convenio_unc,
      costo_total_infra: form.costo_total_infra,
      ok_gob: form.ok_gob,
      obs: form.obs || undefined,
      geo_puntos: parseGeoText(geoText),
    })
  }

  const tipoLabel = TIPO_CONFIG[tipo].label

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={onClose}>
      <div className="bg-white rounded-lg w-[760px] max-w-[97vw] max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">+ Nuevo proyecto — {tipoLabel}</h3>
          <button type="button" onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Nombre / Denominación *</label>
              <input className={inp} value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} autoFocus />
            </div>
            <div>
              <label className={lbl}>Departamento</label>
              <select className={inp} value={deptoGeo} onChange={(e) => { setDeptoGeo(e.target.value); setForm((p) => ({ ...p, departamento: e.target.value || undefined, localidad_nombre: '', localidad_id: undefined })) }}>
                <option value="">— Seleccionar —</option>
                {deptosGeo.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Localidad *</label>
              <select className={inp} value={form.localidad_id ?? ''} onChange={(e) => selectLocalidad(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {localidadesFiltradas.map((g) => <option key={g.id_geo} value={g.id_geo}>{g.localidad.toUpperCase()}</option>)}
              </select>
              {form.localidad_nombre && <p className="text-xs text-gray-500 mt-0.5">Seleccionada: <b className="uppercase">{form.localidad_nombre}</b></p>}
            </div>
            <div>
              <label className={lbl}>Expediente</label>
              <input className={inp + ' font-mono'} value={form.expediente ?? ''} onChange={(e) => set('expediente', e.target.value || undefined)} />
            </div>
            <div>
              <label className={lbl}>Responsable</label>
              <input className={inp} value={form.responsable ?? ''} onChange={(e) => set('responsable', e.target.value || undefined)} />
            </div>
            <div>
              <label className={lbl}>Superficie (Ha)</label>
              <input type="number" step="0.0001" className={inp} value={form.superficie ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                  set('superficie', v)
                  if (v != null) {
                    const lotesCalc = Math.round(v * lotesPorHa)
                    set('lotes', lotesCalc)
                    if (tipo === 'muni' && montoPorLoteMuni != null) set('monto', lotesCalc * montoPorLoteMuni)
                  }
                }} />
            </div>
            <div>
              <label className={lbl}>
                Lotes
                {lotesMatchAuto && <span className="ml-2 text-[10px] text-cyan-600 font-medium normal-case">= {form.superficie} Ha × {lotesPorHa}</span>}
              </label>
              <input type="number" className={inp} value={form.lotes ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : parseInt(e.target.value)
                  set('lotes', v)
                  if (tipo === 'muni' && v != null && montoPorLoteMuni != null) set('monto', v * montoPorLoteMuni)
                }} />
            </div>
            <div>
              <label className={lbl}>
                Monto ($)
                {tipo === 'muni' && form.lotes != null && montoPorLoteMuni != null && (
                  <span className="ml-2 text-[10px] text-cyan-600 font-medium normal-case">= {form.lotes} lotes × ${montoPorLoteMuni.toLocaleString('es-AR')}</span>
                )}
              </label>
              <input type="number" className={inp} value={form.monto ?? ''} onChange={(e) => set('monto', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
            </div>
            {tieneFinanciero && <>
              {tipo === 'exp' && (
                <div>
                  <label className={lbl}>Valor Fiscal ($)</label>
                  <input type="number" className={inp} value={form.valor_fiscal ?? ''} onChange={(e) => set('valor_fiscal', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
              )}
              <div>
                <label className={lbl}>INFRA SIN NEXOS ($)</label>
                <input type="number" className={inp} value={form.infra_sin_nexos ?? ''} onChange={(e) => set('infra_sin_nexos', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
              </div>
              <div>
                <label className={lbl}>Costo NEXOS ($)</label>
                <input type="number" className={inp} value={form.costo_nexos ?? ''} onChange={(e) => set('costo_nexos', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
              </div>
            </>}
          </div>
          <div>
            <label className={lbl}>Geolocalización — una coordenada por línea (lat,lng)</label>
            <textarea className={inp + ' font-mono text-xs'} rows={3} value={geoText}
              onChange={(e) => setGeoText(e.target.value)} placeholder={'-31.292807,-64.177675'} />
          </div>
          {saveError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{saveError}</p>}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-sm border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button type="button" disabled={createMut.isPending || !form.nombre?.trim() || !form.localidad_nombre?.trim()} onClick={handleSubmit}
            className="px-5 py-1.5 rounded text-sm text-white disabled:opacity-50 transition-colors hover:opacity-90"
            style={{ background: TIPO_CONFIG[tipo].color }}>
            {createMut.isPending ? 'Guardando...' : '+ Agregar proyecto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de parámetros ───────────────────────────────────────────────────────

function EstadosCatalogPanel({
  estados, tipo, onInvalidate,
}: {
  estados: EstadoML[]; tipo: string; onInvalidate: () => void
}) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EstadoMLUpdate>({})
  const [editSaveError, setEditSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<Record<number, string>>({})
  const [showNew, setShowNew] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newForm, setNewForm] = useState<EstadoMLCreate>({
    label: '', bg: '#e2e8f0', text_color: '#1e293b', orden: (estados.length + 1) * 10, tipo,
    aplica_juridico: true, aplica_tecnico: true, aplica_financiero: true,
  })

  const inp = 'border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EstadoMLUpdate }) => miLugarApi.updateEstado(id, data),
    onSuccess: () => { onInvalidate(); setEditId(null); setEditSaveError(null) },
    onError: (err: unknown) => setEditSaveError(extractErrorMessage(err, 'Error al guardar el estado.')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => miLugarApi.deleteEstado(id),
    onSuccess: () => onInvalidate(),
    onError: (err: unknown, id: number) => {
      setDeleteError((prev) => ({ ...prev, [id]: extractErrorMessage(err, 'Error al eliminar el estado.') }))
    },
  })

  const createMut = useMutation({
    mutationFn: (data: EstadoMLCreate) => miLugarApi.createEstado(data),
    onSuccess: () => {
      onInvalidate()
      setShowNew(false); setCreateError(null)
      setNewForm({ label: '', bg: '#e2e8f0', text_color: '#1e293b', orden: (estados.length + 2) * 10, tipo, aplica_juridico: true, aplica_tecnico: true, aplica_financiero: true })
    },
    onError: (err: unknown) => setCreateError(extractErrorMessage(err, 'Error al crear el estado.')),
  })

  return (
    <div className="space-y-3">
      {estados.map((e) => (
        <div key={e.id}>
          {editId === e.id ? (
            <div className="border border-sky-200 rounded p-3 space-y-2 bg-sky-50">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Label</label>
                  <input className={inp + ' w-full text-sm'} value={editForm.label ?? e.label}
                    onChange={(ev) => setEditForm((p) => ({ ...p, label: ev.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Orden</label>
                  <input type="number" className={inp + ' w-full text-sm'} value={editForm.orden ?? e.orden}
                    onChange={(ev) => setEditForm((p) => ({ ...p, orden: parseInt(ev.target.value) }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Color fondo</label>
                  <div className="flex gap-1">
                    <input type="color" className="h-7 w-8 rounded border border-slate-200 cursor-pointer" value={editForm.bg ?? e.bg}
                      onChange={(ev) => setEditForm((p) => ({ ...p, bg: ev.target.value }))} />
                    <input className={inp + ' flex-1 text-xs font-mono'} value={editForm.bg ?? e.bg}
                      onChange={(ev) => setEditForm((p) => ({ ...p, bg: ev.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Color texto</label>
                  <div className="flex gap-1">
                    <input type="color" className="h-7 w-8 rounded border border-slate-200 cursor-pointer" value={editForm.text_color ?? e.text_color}
                      onChange={(ev) => setEditForm((p) => ({ ...p, text_color: ev.target.value }))} />
                    <input className={inp + ' flex-1 text-xs font-mono'} value={editForm.text_color ?? e.text_color}
                      onChange={(ev) => setEditForm((p) => ({ ...p, text_color: ev.target.value }))} />
                  </div>
                </div>
              </div>
              {editSaveError && <p role="alert" className="text-xs text-red-600">{editSaveError}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditId(null); setEditForm({}); setEditSaveError(null) }} className="px-3 py-1 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button disabled={updateMut.isPending} onClick={() => updateMut.mutate({ id: e.id, data: editForm })}
                  className="px-3 py-1 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--color-gov-navy)' }}>
                  {updateMut.isPending ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 border border-slate-100 rounded px-3 py-2 bg-white">
              <span className="w-5 text-xs text-gray-400 text-center">{e.orden}</span>
              <span className="flex-1 text-sm">{e.label}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: e.bg, color: e.text_color }}>{e.label}</span>
              <button onClick={() => { setEditId(e.id); setEditForm({}) }} className="p-1 rounded text-gray-400 hover:text-gov-navy hover:bg-sky-50 transition-colors" aria-label="Editar estado">
                <IconEdit />
              </button>
              <button onClick={() => deleteMut.mutate(e.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" aria-label="Eliminar estado">
                <IconTrash />
              </button>
            </div>
          )}
          {deleteError[e.id] && (
            <p role="alert" className="text-xs text-red-600 mt-1 px-3">{deleteError[e.id]}</p>
          )}
        </div>
      ))}
      {showNew ? (
        <div className="border border-sky-200 rounded p-3 space-y-2 bg-sky-50">
          <p className="text-xs font-bold uppercase text-gray-500">Nuevo estado</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Label *</label>
              <input className={inp + ' w-full text-sm'} autoFocus value={newForm.label}
                onChange={(e) => setNewForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Color fondo</label>
              <div className="flex gap-1">
                <input type="color" className="h-7 w-8 rounded border border-slate-200 cursor-pointer" value={newForm.bg}
                  onChange={(e) => setNewForm((p) => ({ ...p, bg: e.target.value }))} />
                <input className={inp + ' flex-1 text-xs font-mono'} value={newForm.bg}
                  onChange={(e) => setNewForm((p) => ({ ...p, bg: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Color texto</label>
              <div className="flex gap-1">
                <input type="color" className="h-7 w-8 rounded border border-slate-200 cursor-pointer" value={newForm.text_color}
                  onChange={(e) => setNewForm((p) => ({ ...p, text_color: e.target.value }))} />
                <input className={inp + ' flex-1 text-xs font-mono'} value={newForm.text_color}
                  onChange={(e) => setNewForm((p) => ({ ...p, text_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Orden</label>
              <input type="number" className={inp + ' w-full text-sm'} value={newForm.orden}
                onChange={(e) => setNewForm((p) => ({ ...p, orden: parseInt(e.target.value) }))} />
            </div>
          </div>
          {createError && <p role="alert" className="text-xs text-red-600">{createError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowNew(false); setCreateError(null) }} className="px-3 py-1 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button disabled={createMut.isPending || !newForm.label.trim()} onClick={() => createMut.mutate(newForm)}
              className="px-3 py-1 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--color-gov-navy)' }}>
              {createMut.isPending ? '...' : '+ Crear'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowNew(true)} className="w-full text-sm font-medium py-2 rounded border-2 border-dashed border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors">
          + Agregar estado
        </button>
      )}
    </div>
  )
}

// ── Modal de parámetros ───────────────────────────────────────────────────────

function GestionarParametrosModal({
  estadosExp, estadosMuni, estadosProv, config, onClose,
}: {
  estadosExp: EstadoML[]; estadosMuni: EstadoML[]; estadosProv: EstadoML[]
  config: ConfigML | null; onClose: () => void
}) {
  const uid = useId()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'estados' | 'parametros'>('estados')
  const [estadoTipoTab, setEstadoTipoTab] = useState<'exp' | 'muni' | 'prov'>('exp')

  const [configForm, setConfigForm] = useState({
    tipo_cambio: String(config?.tipo_cambio ?? '1450'),
    usd_por_lote: String(config?.usd_por_lote ?? '10000'),
    lotes_por_ha: String(config?.lotes_por_ha ?? '25'),
    monto_por_lote_muni: String(config?.monto_por_lote_muni ?? '14000000'),
  })
  const [configError, setConfigError] = useState<string | null>(null)

  const configMut = useMutation({
    mutationFn: (data: { tipo_cambio?: number; usd_por_lote?: number; lotes_por_ha?: number; monto_por_lote_muni?: number }) =>
      miLugarApi.updateConfig(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ml-config'] }); setConfigError(null) },
    onError: (err: unknown) => setConfigError(extractErrorMessage(err, 'Error al guardar la configuración.')),
  })

  const invalidateEstados = () => qc.invalidateQueries({ queryKey: ['ml-estados'] })

  const estadosByTipoTab = { exp: estadosExp, muni: estadosMuni, prov: estadosProv }
  const tipoTabLabels: Record<string, string> = {
    exp: 'Expropiaciones',
    muni: 'Conv. Municipios',
    prov: 'Lotes Provinciales',
  }

  const inp = 'border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
      <div className="bg-white rounded-lg w-[640px] max-w-[97vw] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">⚙ Parámetros — Mi Lugar</h3>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>
        <div className="flex border-b border-slate-200 px-4 pt-3 gap-1">
          {(['estados', 'parametros'] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-t border-b-2 transition-colors ${
                activeTab === t ? 'border-gov-navy text-gov-navy bg-slate-50' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t === 'estados' ? 'Catálogo de estados' : 'Parámetros financieros'}
            </button>
          ))}
        </div>

        {activeTab === 'parametros' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'tipo_cambio', label: 'Tipo de cambio ($/US$)' },
                { key: 'usd_por_lote', label: 'US$ por lote' },
                { key: 'lotes_por_ha', label: 'Lotes por hectárea' },
                { key: 'monto_por_lote_muni', label: 'Monto por lote — Municipios ($)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
                  <input type="number" className={inp + ' w-full'}
                    value={configForm[key as keyof typeof configForm]}
                    onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            {configError && <p role="alert" className="text-xs text-red-600">{configError}</p>}
            <div className="flex justify-end">
              <button disabled={configMut.isPending}
                onClick={() => configMut.mutate({
                  tipo_cambio: parseFloat(configForm.tipo_cambio),
                  usd_por_lote: parseFloat(configForm.usd_por_lote),
                  lotes_por_ha: parseFloat(configForm.lotes_por_ha),
                  monto_por_lote_muni: parseFloat(configForm.monto_por_lote_muni),
                })}
                className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--color-gov-navy)' }}>
                {configMut.isPending ? 'Guardando...' : configMut.isSuccess ? '✓ Guardado' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'estados' && (
          <div className="px-5 pt-4 pb-5 space-y-3">
            {/* Sub-tabs por tipo */}
            <div className="flex gap-1 border-b border-slate-200 mb-3">
              {(['exp', 'muni', 'prov'] as const).map((t) => (
                <button key={t} onClick={() => setEstadoTipoTab(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-t border-b-2 transition-colors ${
                    estadoTipoTab === t ? 'border-gov-cyan text-gov-cyan bg-sky-50' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {tipoTabLabels[t]}
                </button>
              ))}
            </div>
            <EstadosCatalogPanel
              key={estadoTipoTab}
              estados={estadosByTipoTab[estadoTipoTab]}
              tipo={estadoTipoTab}
              onInvalidate={invalidateEstados}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal de informe ──────────────────────────────────────────────────────────

function InformeMLModal({
  allExp, allMuni, allProv, estados, onClose,
}: {
  allExp: ProyectoML[]
  allMuni: ProyectoML[]
  allProv: ProyectoML[]
  estados: EstadoML[]
  onClose: () => void
}) {
  const uid = useId()
  const allProyectos = [...allExp, ...allMuni, ...allProv]

  // Construir puntos para el mapa (un PuntoInforme por geo_punto)
  const puntosMap: PuntoInforme[] = allProyectos.flatMap((p) =>
    p.geo_puntos.map((geo) => {
      const eg = estados.find((e) => e.id === p.estado_general)
      return {
        id: `${p.id}-${geo.id}`,
        nombre: p.nombre,
        departamento: p.departamento,
        lat: geo.lat,
        lon: geo.lng,
        estado_general_id: p.estado_general,
        estado_label: TIPO_CONFIG[p.tipo].label,
        estado_bg: TIPO_CONFIG[p.tipo].color,
        estado_text_color: '#fff',
        expediente: p.expediente,
        monto: p.monto != null ? Number(p.monto) : null,
        // extra data en descripción del popup (estado real)
        ...(eg ? { estado_label: `${TIPO_CONFIG[p.tipo].label} · ${eg.label}`, estado_bg: eg.bg, estado_text_color: eg.text_color } : {}),
      }
    })
  )

  const sinCoordenadas = allProyectos.filter((p) => p.geo_puntos.length === 0).length
  const totalLotes = allProyectos.reduce((s, p) => s + (p.lotes ?? 0), 0)
  const totalMonto = allProyectos.reduce((s, p) => s + (p.monto ?? 0), 0)

  // Distribución por estado_general
  const porEstado = useMemo(() => {
    const map = new Map<string, { label: string; bg: string; text: string; count: number }>()
    for (const p of allProyectos) {
      const eg = estados.find((e) => e.id === p.estado_general)
      const key = eg ? String(eg.id) : 'sin'
      if (!map.has(key)) map.set(key, { label: eg?.label ?? 'Sin estado', bg: eg?.bg ?? '#e2e8f0', text: eg?.text_color ?? '#374151', count: 0 })
      map.get(key)!.count++
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [allProyectos, estados])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
      <div className="bg-white rounded-lg w-[900px] max-w-[97vw] max-h-[93vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center gap-3 sticky top-0 z-10 rounded-t-lg" style={{ background: 'var(--color-gov-navy)' }}>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gov-cyan mb-0.5">Mi Lugar — Adquisición de Tierras</p>
            <h3 id={`${uid}-t`} className="text-white font-semibold text-sm">Informe de situación</h3>
          </div>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Totales */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Expropiaciones', value: allExp.length, sub: `${allExp.reduce((s,p)=>s+(p.lotes??0),0).toLocaleString('es-AR')} lotes`, color: TIPO_CONFIG.exp.color },
              { label: 'Conv. Municipios', value: allMuni.length, sub: `${allMuni.reduce((s,p)=>s+(p.lotes??0),0).toLocaleString('es-AR')} lotes`, color: TIPO_CONFIG.muni.color },
              { label: 'Lotes Provinciales', value: allProv.length, sub: `${allProv.reduce((s,p)=>s+(p.lotes??0),0).toLocaleString('es-AR')} lotes`, color: TIPO_CONFIG.prov.color },
              { label: 'Total proyectos', value: allProyectos.length, sub: `${totalLotes.toLocaleString('es-AR')} lotes totales`, color: 'var(--color-gov-navy)' },
              { label: 'Monto total', value: totalMonto > 0 ? fmtMontoResumen(totalMonto) : '—', sub: 'comprometido', color: '#22c55e' },
              { label: 'Sin coordenadas', value: sinCoordenadas, sub: 'proyectos sin geo', color: '#94a3b8' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-md px-4 py-3 min-w-[120px] shadow-sm border border-slate-100" style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="text-2xl font-bold leading-none" style={{ color: c.color }}>{typeof c.value === 'number' ? c.value : c.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{c.label}</div>
                {c.sub && <div className="text-[10px] text-gray-400 mt-0.5">{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Mapa */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gov-navy">Mapa de puntos de lotes</h4>
              <div className="flex gap-3 flex-wrap">
                {(['exp', 'muni', 'prov'] as TipoProyectoML[]).map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TIPO_CONFIG[t].color }} aria-hidden="true" />
                    {TIPO_CONFIG[t].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-md overflow-hidden border border-slate-200">
              {puntosMap.length > 0
                ? <MapaDualPuntos puntos={puntosMap} height={420} centerLat={-31.5} centerLon={-64.5} zoom={6} />
                : <div className="h-64 flex items-center justify-center text-sm text-gray-400 bg-slate-50">Ningún proyecto tiene coordenadas geo cargadas.</div>
              }
            </div>
            {sinCoordenadas > 0 && (
              <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                {sinCoordenadas} proyecto{sinCoordenadas !== 1 ? 's' : ''} no tienen coordenadas registradas y no aparecen en el mapa.
              </p>
            )}
          </div>

          {/* Distribución por estado general */}
          {porEstado.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gov-navy mb-2">Distribución por estado general</h4>
              <div className="flex flex-col gap-1.5">
                {porEstado.map((e) => (
                  <div key={e.label} className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold w-48 text-center truncate" style={{ background: e.bg, color: e.text }}>{e.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((e.count / allProyectos.length) * 100)}%`, background: e.bg }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-6 text-right">{e.count}</span>
                    <span className="text-xs text-gray-400 w-9">{Math.round((e.count / allProyectos.length) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function MiLugarPage() {
  const qc = useQueryClient()
  const { data: user } = usePortalUser()
  const canManage = user?.rol === 'Admin' || user?.rol === 'Supervisor'
  const canEdit = canManage || user?.rol === 'Operador'

  const searchId = useId()
  const deptoId = useId()
  const egId = useId()
  const ejId = useId()
  const etId = useId()
  const efId = useId()

  const [tab, setTab] = useState<TipoProyectoML>('exp')
  const [search, setSearch] = useState('')
  const [deptoFilter, setDeptoFilter] = useState('')
  const [egFilter, setEgFilter] = useState('')
  const [ejFilter, setEjFilter] = useState('')
  const [etFilter, setEtFilter] = useState('')
  const [efFilter, setEfFilter] = useState('')
  const [editTarget, setEditTarget] = useState<ProyectoML | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<ProyectoML | null>(null)
  const [showParams, setShowParams] = useState(false)
  const [showAgregar, setShowAgregar] = useState(false)
  const [showInforme, setShowInforme] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const estadosExpQuery = useQuery({ queryKey: ['ml-estados', 'exp'], queryFn: () => miLugarApi.getEstados({ tipo: 'exp' }) })
  const estadosMuniQuery = useQuery({ queryKey: ['ml-estados', 'muni'], queryFn: () => miLugarApi.getEstados({ tipo: 'muni' }) })
  const estadosProvQuery = useQuery({ queryKey: ['ml-estados', 'prov'], queryFn: () => miLugarApi.getEstados({ tipo: 'prov' }) })
  const configQuery = useQuery({ queryKey: ['ml-config'], queryFn: miLugarApi.getConfig })
  const expQuery = useQuery({ queryKey: ['ml-proyectos', 'exp'], queryFn: () => miLugarApi.getProyectos({ tipo: 'exp' }) })
  const muniQuery = useQuery({ queryKey: ['ml-proyectos', 'muni'], queryFn: () => miLugarApi.getProyectos({ tipo: 'muni' }) })
  const provQuery = useQuery({ queryKey: ['ml-proyectos', 'prov'], queryFn: () => miLugarApi.getProyectos({ tipo: 'prov' }) })

  const tabQuery = tab === 'exp' ? expQuery : tab === 'muni' ? muniQuery : provQuery
  const estadosExp = estadosExpQuery.data ?? []
  const estadosMuni = estadosMuniQuery.data ?? []
  const estadosProv = estadosProvQuery.data ?? []
  const estadosByTipo = { exp: estadosExp, muni: estadosMuni, prov: estadosProv }
  const estados = estadosByTipo[tab]
  const todosEstados = [...estadosExp, ...estadosMuni, ...estadosProv]
  const config = configQuery.data ?? null
  const proyectos = tabQuery.data ?? []

  const allExp = expQuery.data ?? []
  const allMuni = muniQuery.data ?? []
  const allProv = provQuery.data ?? []
  const allProyectos = [...allExp, ...allMuni, ...allProv]
  const totalLotes = allProyectos.reduce((s, p) => s + (p.lotes ?? 0), 0)
  const totalMonto = allProyectos.reduce((s, p) => s + (p.monto ?? 0), 0)

  const updateMut = useMutation({
    mutationFn: ({ id, upd }: { id: string; upd: ProyectoMLUpdate }) => miLugarApi.updateProyecto(id, upd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-proyectos'] })
      setEditTarget(null); setEditError(null)
    },
    onError: (err: unknown) => setEditError(extractErrorMessage(err, 'Error al guardar los cambios.')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => miLugarApi.deleteProyecto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-proyectos'] })
      setConfirmDeleteId(null); setDetailTarget(null); setDeleteError(null)
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err, 'Error al eliminar el registro.')),
  })

  const deptos = useMemo(
    () => [...new Set(proyectos.map((p) => p.departamento).filter(Boolean) as string[])].sort(),
    [proyectos]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return proyectos.filter((p) => {
      if (q && !`${p.nombre} ${p.expediente ?? ''} ${p.obs ?? ''}`.toLowerCase().includes(q)) return false
      if (deptoFilter && p.departamento !== deptoFilter) return false
      if (egFilter && String(p.estado_general) !== egFilter) return false
      if (ejFilter && String(p.ejuridico) !== ejFilter) return false
      if (etFilter && String(p.etecnico) !== etFilter) return false
      if (efFilter && String(p.efinanciero) !== efFilter) return false
      return true
    })
  }, [proyectos, search, deptoFilter, egFilter, ejFilter, etFilter, efFilter])

  const handleSort = (key: string) => {
    setSortDir((prev) => (sortCol === key && prev === 'asc' ? 'desc' : 'asc'))
    setSortCol(key)
  }
  const sortIndicator = (key: string) => (
    <span className="text-sky-300/70 text-[9px] ml-0.5">{sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  )

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortCol === 'avance') return dir * (avancePct(a, estados) - avancePct(b, estados))
      const va = (a as unknown as Record<string, unknown>)[sortCol] as string | number | null ?? null
      const vb = (b as unknown as Record<string, unknown>)[sortCol] as string | number | null ?? null
      if (va === null && vb === null) return 0
      if (va === null) return dir
      if (vb === null) return -dir
      if (typeof va === 'string') return dir * va.localeCompare(vb as string, 'es')
      return dir * (va - (vb as number))
    })
  }, [filtered, sortCol, sortDir, estados])

  const hasFilters = !!(search || deptoFilter || egFilter || ejFilter || etFilter || efFilter)
  const tieneFinanciero = tab === 'exp' || tab === 'prov'
  const { label: tabLabel } = TIPO_CONFIG[tab]

  const th = `px-2.5 py-2 text-left font-semibold whitespace-nowrap select-none cursor-pointer hover:bg-white/10`
  const thFixed = `px-2.5 py-2 text-left font-semibold whitespace-nowrap select-none`

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gov-cyan mb-1">Programa Provincial — Secretaría de Vivienda</p>
        <h2 className="text-xl font-bold text-gov-navy">Mi Lugar — Adquisición de Tierras</h2>
        <p className="text-xs text-gray-400 mt-0.5">Gestión de predios para proyectos habitacionales: expropiaciones, municipios y lotes provinciales.</p>
      </div>

      {/* KPI cards */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: 'Expropiaciones', value: String(allExp.length), color: TIPO_CONFIG.exp.color },
          { label: 'Convenios Municipios', value: String(allMuni.length), color: TIPO_CONFIG.muni.color },
          { label: 'Lotes Provinciales', value: String(allProv.length), color: TIPO_CONFIG.prov.color },
          { label: 'Total proyectos', value: String(allProyectos.length), color: 'var(--color-gov-navy)' },
          { label: 'Lotes totales', value: totalLotes.toLocaleString('es-AR'), color: 'var(--color-gov-blue)' },
          { label: 'Monto comprometido', value: totalMonto > 0 ? fmtMontoResumen(totalMonto) : '—', color: '#22c55e' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-md px-4 py-3 min-w-[130px] shadow-sm border border-slate-100" style={{ borderTop: `4px solid ${c.color}` }}>
            <div className="text-2xl font-bold leading-none" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs por tipo */}
      <div className="flex gap-0 mb-0 border-b border-slate-200">
        {(['exp', 'muni', 'prov'] as TipoProyectoML[]).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setSortCol(''); setSearch(''); setDeptoFilter(''); setEgFilter(''); setEjFilter(''); setEtFilter(''); setEfFilter('') }}
            className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${tab === t ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            style={tab === t ? { color: TIPO_CONFIG[t].color, borderColor: TIPO_CONFIG[t].color } : undefined}>
            {TIPO_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Barra de acciones */}
      <div className="flex items-center gap-2 mt-3 mb-2">
        <button onClick={() => setShowInforme(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-gov-navy text-gov-navy hover:bg-slate-50 transition-colors">
          📊 Ver informe
        </button>
        <button
          onClick={() => exportXlsx(sorted, estados, tab)}
          disabled={!sorted.length}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
          title={`Exportar ${sorted.length} registros a Excel`}>
          ↓ Exportar ({sorted.length})
        </button>
        <div className="flex-1" />
        {canEdit && (
          <button onClick={() => setShowAgregar(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-gov-cyan text-gov-cyan hover:bg-sky-50 transition-colors">
            + Agregar proyecto
          </button>
        )}
        {canManage && (
          <button onClick={() => setShowParams(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 text-gray-600 hover:bg-slate-50 transition-colors"
            title="Gestionar parámetros y estados">
            ⚙ Parámetros
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-t-md px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor={searchId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Buscar</label>
          <input id={searchId} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, expediente, observaciones..."
            className="border border-slate-200 rounded px-2 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={deptoId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Depto.</label>
          <select id={deptoId} value={deptoFilter} onChange={(e) => setDeptoFilter(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            {deptos.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={egId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Est. General</label>
          <select id={egId} value={egFilter} onChange={(e) => setEgFilter(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            {estados.map((e) => <option key={e.id} value={String(e.id)}>{e.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={ejId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Est. Jurídico</label>
          <select id={ejId} value={ejFilter} onChange={(e) => setEjFilter(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            {estados.filter((e) => e.aplica_juridico).map((e) => <option key={e.id} value={String(e.id)}>{e.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={etId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Est. Técnico</label>
          <select id={etId} value={etFilter} onChange={(e) => setEtFilter(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            {estados.filter((e) => e.aplica_tecnico).map((e) => <option key={e.id} value={String(e.id)}>{e.label}</option>)}
          </select>
        </div>
        {tieneFinanciero && (
          <div className="flex items-center gap-2">
            <label htmlFor={efId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Est. Presup.</label>
            <select id={efId} value={efFilter} onChange={(e) => setEfFilter(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
              <option value="">— Todos —</option>
              {estados.filter((e) => e.aplica_financiero).map((e) => <option key={e.id} value={String(e.id)}>{e.label}</option>)}
            </select>
          </div>
        )}
        {hasFilters && (
          <button onClick={() => { setSearch(''); setDeptoFilter(''); setEgFilter(''); setEjFilter(''); setEtFilter(''); setEfFilter('') }}
            className="border border-slate-200 rounded px-3 py-1 text-xs font-bold text-gray-600 hover:bg-slate-50 transition-colors">
            ✕ Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400" aria-live="polite">{filtered.length} proyectos</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-b-md shadow-sm border border-t-0 border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <span className="text-xs font-bold text-gov-navy">{tabLabel} — Mi Lugar</span>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold text-gov-navy mr-1">Estados:</span>
          {estados.map((e) => (
            <span key={e.id} className="flex items-center gap-1 text-xs text-gray-600">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.bg, border: `1px solid ${e.text_color}` }} aria-hidden="true" />
              {e.label}
            </span>
          ))}
        </div>
        <p className="sm:hidden text-[11px] text-gray-400 px-4 pt-2" aria-hidden="true">← Desliza para ver todas las columnas →</p>
        <div className="overflow-x-auto" role="region" aria-label="Tabla de proyectos Mi Lugar">
          <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--color-gov-navy)', color: '#fff' }}>
                <th scope="col" style={S1_HEAD} className={thFixed + ' cursor-pointer hover:bg-white/10'} onClick={() => handleSort('nombre')}>
                  <span className="flex items-center gap-0.5">#</span>
                </th>
                <th scope="col" style={S2_HEAD} className={th} onClick={() => handleSort('nombre')}>
                  <span className="flex items-center gap-0.5">Nombre {sortIndicator('nombre')}</span>
                </th>
                <th scope="col" className={th} onClick={() => handleSort('localidad_nombre')} style={{ fontSize: '11px' }}>
                  <span className="flex items-center gap-0.5">Localidad {sortIndicator('localidad_nombre')}</span>
                </th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>Expediente</th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>Geo</th>
                <th scope="col" className={th} onClick={() => handleSort('superficie')} style={{ fontSize: '11px' }}>
                  <span className="flex items-center gap-0.5">Sup. (Ha) {sortIndicator('superficie')}</span>
                </th>
                <th scope="col" className={th} onClick={() => handleSort('lotes')} style={{ fontSize: '11px' }}>
                  <span className="flex items-center gap-0.5">Lotes {sortIndicator('lotes')}</span>
                </th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>E.Jurídico</th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>E.Técnico</th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>E.Presup.</th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>E.General</th>
                <th scope="col" className={th} onClick={() => handleSort('monto')} style={{ fontSize: '11px' }}>
                  <span className="flex items-center gap-0.5">Monto {sortIndicator('monto')}</span>
                </th>
                {tieneFinanciero && <>
                  {tab === 'exp' && <th scope="col" className={thFixed} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}>Valor Fiscal</th>}
                  <th scope="col" className={thFixed} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}>Infra s/Nexos</th>
                  <th scope="col" className={thFixed} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}>Nexos</th>
                  <th scope="col" className={thFixed} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}>UNC</th>
                  <th scope="col" className={thFixed} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}>Costo Total</th>
                </>}
                <th scope="col" className={th} onClick={() => handleSort('avance')} style={{ fontSize: '11px' }}>
                  <span className="flex items-center gap-0.5">Avance {sortIndicator('avance')}</span>
                </th>
                <th scope="col" className={thFixed} style={{ fontSize: '11px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && (
                <tr>
                  <td colSpan={tieneFinanciero ? (tab === 'exp' ? 19 : 18) : 15}
                    className="text-center py-10 text-gray-400">
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              )}
              {sorted.map((p, idx) => {
                const pct = avancePct(p, estados)
                const col = avanceColor(pct)
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition-colors">
                    <td style={S1_BODY} className="px-2.5 py-1.5 text-gray-400 text-center">{idx + 1}</td>
                    <td style={S2_BODY} className="p-0 font-bold">
                      <button onClick={() => setDetailTarget(p)}
                        className="w-full px-2.5 py-1.5 text-left font-bold hover:text-gov-cyan transition-colors group"
                        title="Ver historial / comunicaciones">
                        {p.nombre}
                        <span className="block text-[9px] font-normal text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity leading-none">Ver historial</span>
                      </button>
                    </td>
                    <td className="px-2.5 py-1.5">
                      {p.departamento
                        ? <><span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap uppercase" style={{ background: '#E8EAF6', color: '#283593' }}>{p.departamento}</span><br /></>
                        : null}
                      <span className="text-xs text-gray-600 uppercase">{p.localidad_nombre}</span>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-gray-600" style={{ fontSize: '11px' }}>{p.expediente || '—'}</td>
                    <td className="px-2.5 py-1.5"><GeoLinks puntos={p.geo_puntos} /></td>
                    <td className="px-2.5 py-1.5 text-gray-700" style={{ fontSize: '11px' }}>{p.superficie != null ? `${p.superficie}` : '—'}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-center" style={{ fontSize: '11px' }}>{p.lotes?.toLocaleString('es-AR') ?? '—'}</td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={p.ejuridico} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={p.etecnico} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={p.efinanciero} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={p.estado_general} estados={estados} /></td>
                    <td className="px-2.5 py-1.5 font-semibold text-gov-blue whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(p.monto)}</td>
                    {tieneFinanciero && <>
                      {tab === 'exp' && <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(p.valor_fiscal)}</td>}
                      <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(p.infra_sin_nexos)}</td>
                      <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(p.costo_nexos)}</td>
                      <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(p.convenio_unc)}</td>
                      <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(p.costo_total_infra)}</td>
                    </>}
                    <td className="px-2.5 py-1.5 min-w-[90px]">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance ${pct}%`}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                        </div>
                        <span className="text-gray-500 w-7 text-right" style={{ fontSize: '11px' }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <button onClick={() => setDetailTarget(p)} className="p-1 rounded text-gray-500 hover:text-gov-cyan hover:bg-sky-50 transition-colors" aria-label={`Ver historial de ${p.nombre}`} title="Ver historial / comunicaciones">
                        <IconClipboard />
                      </button>
                      {canEdit && (
                        <button onClick={() => { setEditTarget(p); setEditError(null) }} className="p-1 rounded text-gray-500 hover:text-gov-navy hover:bg-sky-50 transition-colors ml-0.5" aria-label={`Editar ${p.nombre}`} title="Editar">
                          <IconEdit />
                        </button>
                      )}
                      {canManage && (
                        <>
                          {confirmDeleteId === p.id ? (
                            <span className="inline-flex flex-col items-end gap-1 ml-0.5">
                              <span className="inline-flex items-center gap-1">
                                <button onClick={() => deleteMut.mutate(p.id)} disabled={deleteMut.isPending}
                                  className="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 transition-colors">
                                  {deleteMut.isPending ? '...' : 'Sí'}
                                </button>
                                <button onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                                  className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">
                                  No
                                </button>
                              </span>
                              {deleteError && confirmDeleteId === p.id && (
                                <span role="alert" className="text-[10px] text-red-600 whitespace-nowrap">{deleteError}</span>
                              )}
                            </span>
                          ) : (
                            <button onClick={() => { setConfirmDeleteId(p.id); setDeleteError(null) }}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5" aria-label={`Eliminar ${p.nombre}`} title="Eliminar">
                              <IconTrash />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <EditModal
          proyecto={editTarget}
          estados={estadosByTipo[editTarget.tipo] ?? estadosExp}
          config={config}
          isSaving={updateMut.isPending}
          saveError={editError}
          onClose={() => { setEditTarget(null); setEditError(null) }}
          onSave={(upd) => updateMut.mutate({ id: editTarget.id, upd })}
        />
      )}
      {detailTarget && (
        <DetailPanel proyecto={detailTarget} estados={estadosByTipo[detailTarget.tipo] ?? estadosExp} onClose={() => setDetailTarget(null)} />
      )}
      {showParams && canManage && (
        <GestionarParametrosModal estadosExp={estadosExp} estadosMuni={estadosMuni} estadosProv={estadosProv} config={config} onClose={() => setShowParams(false)} />
      )}
      {showAgregar && (
        <AgregarProyectoModal
          tipo={tab}
          config={config}
          onClose={() => setShowAgregar(false)}
        />
      )}
      {showInforme && (
        <InformeMLModal
          allExp={allExp}
          allMuni={allMuni}
          allProv={allProv}
          estados={todosEstados}
          onClose={() => setShowInforme(false)}
        />
      )}
    </div>
  )
}
