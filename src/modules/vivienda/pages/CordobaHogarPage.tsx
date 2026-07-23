import { useState, useMemo, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cordobaHogarApi } from '../api/vivienda.api'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import { exportToXlsx } from '../../../shared/utils/exportTable'
import type {
  EstadoCH, LocalidadCH, LocalidadCHUpdate, LocalidadCHCreate,
  EstadoCHCreate, EstadoCHUpdate, EstadoHistorialCH, PedidoCH,
} from '../types/vivienda.types'

// ── Helpers ──────────────────────────────────────────────────────────────────────

function fmtMonto(n: number | null) {
  if (!n) return '—'
  return '$' + Number(n).toLocaleString('es-AR')
}
function fmtMontoResumen(n: number) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  return '$' + (n / 1e6).toFixed(1) + 'M'
}
function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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
    const FIELD_LABELS: Record<string, string> = {
      fecha_anuncio: 'Fecha de anuncio',
      fecha_pedido: 'Fecha',
    }
    return detail
      .map((e: { loc?: string[]; msg?: string }) => {
        const field = e.loc?.slice(-1)[0] ?? ''
        const label = FIELD_LABELS[field] ?? field
        return label ? `El campo "${label}" es requerido o contiene un valor inválido.` : (e.msg ?? 'Error de validación.')
      })
      .join(' ')
  }
  if (detail) return JSON.stringify(detail)
  return fallback
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Columnas de tabla ────────────────────────────────────────────────────────────

const CH_COLS: Array<{ label: string | [string, string]; sort: string | null }> = [
  { label: 'Departamento', sort: 'departamento' },
  { label: ['Fecha', 'anuncio'], sort: 'fecha_anuncio' },
  { label: 'Expediente N°', sort: 'expediente' },
  { label: 'Casas', sort: 'cantidad_casas' },
  { label: 'Monto', sort: 'monto' },
  { label: ['OK', 'Ministro'], sort: 'ok_gob' },
  { label: ['Última', 'obs.'], sort: 'doc_exp' },
  { label: ['Últ.', 'modif.'], sort: 'updated_at' },
  { label: ['Estado', 'General'], sort: 'estado_general' },
  { label: ['Estado', 'Jurídico'], sort: 'ejuridico' },
  { label: ['Estado', 'Técnico'], sort: 'etecnico' },
  { label: ['Estado', 'Presup.'], sort: 'efinanciero' },
  { label: 'Avance', sort: 'avance' },
  { label: 'Acciones', sort: null },
]

function avancePct(p: LocalidadCH, estados: EstadoCH[]) {
  const maxPos = Math.max(estados.length - 1, 1)
  const pos = (id: number | null) => {
    if (!id) return 0
    const i = estados.findIndex((e) => e.id === id)
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

const CAMPO_LABELS: Record<string, string> = {
  ejuridico: 'Jurídico',
  etecnico: 'Técnico',
  efinanciero: 'Presupuestario',
}

// ── Sticky column styles ─────────────────────────────────────────────────────────

const S1_HEAD = { position: 'sticky' as const, left: 0, zIndex: 3, background: 'var(--color-gov-navy)', minWidth: 36, width: 36 }
const S2_HEAD = { position: 'sticky' as const, left: 36, zIndex: 3, background: 'var(--color-gov-navy)', minWidth: 160 }
const S1_BODY = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#f8fafc', minWidth: 36, width: 36 }
const S2_BODY = { position: 'sticky' as const, left: 36, zIndex: 2, background: '#f8fafc', minWidth: 160, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)' }

// ── EstadoBadge ──────────────────────────────────────────────────────────────────

function EstadoBadge({ id, estados }: { id: number | null; estados: EstadoCH[] }) {
  const e = estados.find((s) => s.id === id)
  if (!e) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: e.bg, color: e.text_color }}>
      {e.label}
    </span>
  )
}

function OkBadge({ v }: { v: string }) {
  const cls = v === 'SI' ? 'bg-green-100 text-green-800' : v === 'NO' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{v}</span>
}

// ── Modal de edición ─────────────────────────────────────────────────────────────

function EditModal({
  localidad, estados, onSave, onClose, isSaving, saveError,
}: {
  localidad: LocalidadCH; estados: EstadoCH[]
  onSave: (data: LocalidadCHUpdate) => void; onClose: () => void; isSaving: boolean
  saveError?: string | null
}) {
  const uid = useId()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<LocalidadCHUpdate>({
    localidad: localidad.localidad,
    departamento: localidad.departamento ?? undefined,
    fecha_anuncio: localidad.fecha_anuncio ?? null,
    expediente: localidad.expediente ?? '',
    monto: localidad.monto ?? undefined,
    cantidad_casas: localidad.cantidad_casas ?? undefined,
    ok_gob: localidad.ok_gob,
    doc_exp: localidad.doc_exp ?? '',
    ejuridico: localidad.ejuridico,
    etecnico: localidad.etecnico,
    efinanciero: localidad.efinanciero,
    estado_general: localidad.estado_general,
    obs: localidad.obs ?? '',
    fecha_cambio: today,
  })
  const [deptoCascade, setDeptoCascade] = useState(localidad.departamento ?? '')
  // El backend recalcula estado_general automáticamente a partir de las 3 dimensiones
  // SALVO que el payload lo incluya explícitamente (override manual). Como este form
  // siempre trae un valor precargado en ese campo, solo lo incluimos en el submit si
  // el usuario realmente tocó el desplegable — si no, se omite para no pisar el
  // recálculo automático con el valor viejo cada vez que se edita otra cosa.
  const [estadoGeneralTouched, setEstadoGeneralTouched] = useState(false)
  const { data: geoList = [], isLoading: geoLoading } = useQuery({
    queryKey: ['ch-geo'],
    queryFn: cordobaHogarApi.getGeo,
  })
  const set = (k: keyof LocalidadCHUpdate, v: string | number | null | undefined) =>
    setForm((p) => ({ ...p, [k]: v }))
  const lbl = 'block text-xs font-bold text-gray-500 uppercase mb-1'
  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
      <div className="bg-white rounded-lg w-[740px] max-w-[97vw] max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">Editar — {localidad.localidad}</h3>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-dep`} className={lbl}>Departamento</label>
              {geoLoading
                ? <p className="text-xs text-gray-400">Cargando...</p>
                : (
                  <select id={`${uid}-dep`} className={inp} value={deptoCascade}
                    onChange={(e) => {
                      setDeptoCascade(e.target.value)
                      setForm((p) => ({ ...p, departamento: e.target.value || undefined, localidad: '' }))
                    }}>
                    <option value="">— Todos los departamentos —</option>
                    {[...new Set(geoList.map((g) => g.departamento))].sort().map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                )}
            </div>
            <div>
              <label htmlFor={`${uid}-loc`} className={lbl}>Localidad *</label>
              <select
                id={`${uid}-loc`}
                className={inp}
                disabled={!deptoCascade || geoLoading}
                value={geoList.find((g) => g.localidad === form.localidad && g.departamento === deptoCascade)?.id_geo ?? ''}
                onChange={(e) => {
                  const g = geoList.find((x) => x.id_geo === e.target.value)
                  if (g) setForm((p) => ({ ...p, localidad: g.localidad, departamento: g.departamento }))
                }}
              >
                <option value="">— Seleccioná una localidad —</option>
                {geoList.filter((g) => g.departamento === deptoCascade).map((g) => (
                  <option key={g.id_geo} value={g.id_geo}>{g.localidad}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-fecha`} className={lbl}>Fecha de anuncio</label>
              <input id={`${uid}-fecha`} type="date" className={inp} value={form.fecha_anuncio ?? ''} onChange={(e) => set('fecha_anuncio', e.target.value || null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-exp`} className={lbl}>Expediente N°</label>
              <input id={`${uid}-exp`} className={`${inp} font-mono`} value={form.expediente ?? ''} onChange={(e) => set('expediente', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${uid}-casas`} className={lbl}>Cantidad de casas</label>
              <input id={`${uid}-casas`} type="number" className={inp} value={form.cantidad_casas ?? ''} onChange={(e) => set('cantidad_casas', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-monto`} className={lbl}>Monto ($)</label>
              <input id={`${uid}-monto`} type="number" className={inp} value={form.monto ?? ''} onChange={(e) => set('monto', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-ok`} className={lbl}>OK Gobernación</label>
              <select id={`${uid}-ok`} className={inp} value={form.ok_gob ?? 'SI'} onChange={(e) => set('ok_gob', e.target.value)}>
                <option>SI</option><option>NO</option><option>En trámite</option>
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-doc`} className={lbl}>Última observación</label>
              <input id={`${uid}-doc`} className={inp} value={form.doc_exp ?? ''} onChange={(e) => set('doc_exp', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-obs`} className={lbl}>Observaciones</label>
              <textarea id={`${uid}-obs`} rows={2} className={inp} value={form.obs ?? ''} onChange={(e) => set('obs', e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-end gap-4 mb-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gov-navy">Estados por Dimensión</p>
              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor={`${uid}-fcambio`} className="text-xs text-gray-500 whitespace-nowrap">Fecha del cambio:</label>
                <input
                  id={`${uid}-fcambio`}
                  type="date"
                  className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                  value={form.fecha_cambio ?? today}
                  onChange={(e) => set('fecha_cambio', e.target.value || today)}
                  max={today}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['ejuridico', 'etecnico', 'efinanciero'] as const).map((field) => (
                <div key={field} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <label htmlFor={`${uid}-${field}`} className="block text-xs font-bold uppercase mb-2 text-gov-navy">
                    {CAMPO_LABELS[field]}
                  </label>
                  <select id={`${uid}-${field}`} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan" value={form[field] ?? ''}
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
              <select
                id={`${uid}-eg`}
                className="w-full border border-amber-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                value={form.estado_general ?? ''}
                onChange={(e) => {
                  set('estado_general', e.target.value ? Number(e.target.value) : null)
                  setEstadoGeneralTouched(true)
                }}
              >
                <option value="">— Sin estado —</option>
                {estados.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
              <p className="text-[10px] text-amber-600 mt-1">Sobreescribe el cálculo automático por dimensiones.</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {saveError
            ? <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex-1">{saveError}</p>
            : <span />}
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-1.5 rounded text-sm border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button
              onClick={() => {
                if (estadoGeneralTouched) { onSave(form); return }
                const { estado_general: _ignored, ...rest } = form
                onSave(rest)
              }}
              disabled={isSaving}
              className="px-5 py-1.5 rounded text-sm text-white disabled:opacity-50 transition-colors hover:opacity-90"
              style={{ background: 'var(--color-gov-navy)' }}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Historial de estados ─────────────────────────────────────────────────────────

function HistorialEstadosTab({
  localidadId, estados,
}: {
  localidadId: string; estados: EstadoCH[]
}) {
  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['ch-historial', localidadId],
    queryFn: () => cordobaHogarApi.getHistorial(localidadId),
  })
  if (isLoading) return <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
  if (historial.length === 0) return (
    <p className="text-sm text-gray-400 text-center py-8">Sin cambios de estado registrados.</p>
  )
  return (
    <ol className="space-y-3 px-5 py-4">
      {historial.map((h: EstadoHistorialCH, i: number) => (
        <li key={h.id} className="flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: i === 0 ? 'var(--color-gov-cyan)' : '#bae6fd' }} />
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
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <EstadoBadge id={h.estado_nuevo_id} estados={estados} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ── Panel de detalle ─────────────────────────────────────────────────────────────

function DetailPanel({
  localidad, estados, onClose,
}: {
  localidad: LocalidadCH; estados: EstadoCH[]; onClose: () => void
}) {
  const uid = useId()
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState<'comunicaciones' | 'historial'>('comunicaciones')
  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState('')
  const [fecha, setFecha] = useState(today)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: panelUser } = usePortalUser()
  const canWritePedidos = ['Admin', 'Supervisor', 'Operador'].includes(panelUser?.rol ?? '')
    || (panelUser?.secretarias ?? []).includes('infraestructura')
    || (panelUser?.secretarias ?? []).includes('supervision')

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['ch-pedidos', localidad.id],
    queryFn: () => cordobaHogarApi.getPedidos(localidad.id),
  })

  const mutation = useMutation({
    mutationFn: (d: { descripcion: string; fecha_pedido: string }) =>
      cordobaHogarApi.createPedido(localidad.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ch-pedidos', localidad.id] })
      setDesc(''); setFecha(today); setShowForm(false); setSaveError(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Error al guardar.'
      setSaveError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    },
  })

  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (pedidoId: string) => cordobaHogarApi.deletePedido(localidad.id, pedidoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ch-pedidos', localidad.id] })
      setConfirmDelete(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Error al eliminar la actualización.'
      setDeleteError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    },
  })

  const tabCls = (t: typeof tab) =>
    `flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${tab === t
      ? 'border-gov-cyan text-gov-cyan'
      : 'border-transparent text-gray-500 hover:text-gray-700'}`

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
        <div className="px-5 py-4 flex items-start justify-between border-b border-slate-200" style={{ background: 'var(--color-gov-navy)' }}>
          <div>
            <div className="text-[10px] font-semibold tracking-widest mb-0.5 text-gov-cyan uppercase">Córdoba Hogar</div>
            <h3 id={`${uid}-t`} className="text-white font-semibold text-sm">{localidad.localidad}</h3>
            {localidad.departamento && <p className="text-xs mt-0.5 text-white/60">{localidad.departamento}</p>}
          </div>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none ml-4 mt-0.5 transition-colors" aria-label="Cerrar">✕</button>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button className={tabCls('comunicaciones')} onClick={() => setTab('comunicaciones')}>Comunicaciones</button>
          <button className={tabCls('historial')} onClick={() => setTab('historial')}>Cambios de estado</button>
        </div>
        {/* Tab: Comunicaciones */}
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
                  <textarea id={`${uid}-desc`} rows={3} autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describí el pedido o comunicación realizada..." className="w-full border border-sky-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
                  <div className="flex items-center gap-2">
                    <label htmlFor={`${uid}-fecha`} className="text-xs font-bold uppercase text-gray-500 flex-shrink-0">Fecha *</label>
                    <input id={`${uid}-fecha`} type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="border border-sky-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
                  </div>
                  {saveError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{saveError}</p>}
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => { setShowForm(false); setDesc(''); setFecha(today); setSaveError(null) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button onClick={() => { if (desc.trim() && fecha) mutation.mutate({ descripcion: desc.trim(), fecha_pedido: fecha }) }} disabled={mutation.isPending || !desc.trim() || !fecha} className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 transition-colors hover:opacity-90" style={{ background: 'var(--color-gov-navy)' }}>
                      {mutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
              {isLoading && <p role="status" className="text-sm text-gray-400 text-center py-8">Cargando...</p>}
              {!isLoading && pedidos.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin comunicaciones registradas aún.</p>}
              <ol className="space-y-3">
                {pedidos.map((p: PedidoCH, i: number) => (
                  <li key={p.id} className="flex gap-3 group">
                    <div className="flex flex-col items-center" aria-hidden="true">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: i === 0 ? 'var(--color-gov-cyan)' : '#bae6fd' }} />
                      {i < pedidos.length - 1 && <div className="w-px flex-1 mt-1 bg-slate-200" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <time className="text-xs font-semibold text-gov-navy" dateTime={p.fecha_pedido}>
                          {new Date(p.fecha_pedido + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </time>
                        <span className="text-xs text-gray-600">
                          {p.created_by_nombre ?? p.created_by?.split('@')[0] ?? ''}
                        </span>
                        {p.secretaria === 'infraestructura' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">Infraestructura</span>
                        )}
                        {p.secretaria === 'supervision' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">Supervisión</span>
                        )}
                        <button onClick={() => setConfirmDelete(p.id)} className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400" aria-label="Eliminar esta actualización" title="Eliminar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 leading-snug">{p.descripcion}</p>
                      {confirmDelete === p.id && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-700 flex-1">¿Eliminar esta actualización?</span>
                            <button onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending} className="px-2.5 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 transition-colors">{deleteMutation.isPending ? '...' : 'Sí, eliminar'}</button>
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
        {/* Tab: Historial de estados */}
        {tab === 'historial' && (
          <div className="flex-1 overflow-y-auto">
            <HistorialEstadosTab localidadId={localidad.id} estados={estados} />
          </div>
        )}
      </div>
    </>
  )
}

// ── Gestionar parámetros modal ───────────────────────────────────────────────────

function GestionarParametrosModal({
  estados, montoPorCasa, onClose,
}: {
  estados: EstadoCH[]; montoPorCasa: number; onClose: () => void
}) {
  const uid = useId()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'estados' | 'parametros'>('estados')
  const [montoPorCasaInput, setMontoPorCasaInput] = useState(String(montoPorCasa))
  const [montoPorCasaError, setMontoPorCasaError] = useState<string | null>(null)

  const montoPorCasaMut = useMutation({
    mutationFn: (valor: number) => cordobaHogarApi.updateMontoPorCasa(valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] })
      setMontoPorCasaError(null)
    },
    onError: () => setMontoPorCasaError('Error al guardar el monto por casa.'),
  })

  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EstadoCHUpdate>({})
  const [editSaveError, setEditSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<Record<number, string>>({})
  const [showNew, setShowNew] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newForm, setNewForm] = useState<EstadoCHCreate>({
    label: '', bg: '#e2e8f0', text_color: '#1e293b', orden: (estados.length + 1) * 10,
    aplica_juridico: true, aplica_tecnico: true, aplica_financiero: true,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EstadoCHUpdate }) => cordobaHogarApi.updateEstado(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] }); setEditId(null); setEditSaveError(null) },
    onError: (err: unknown) => setEditSaveError(extractErrorMessage(err, 'Error al guardar los cambios del estado.')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cordobaHogarApi.deleteEstado(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] }),
    onError: (err: unknown, id: number) => {
      const detail = (err as any)?.response?.data?.detail
      const msg = typeof detail?.message === 'string'
        ? detail.message
        : 'Error al eliminar el estado.'
      setDeleteError((prev) => ({ ...prev, [id]: msg }))
    },
  })

  const createMut = useMutation({
    mutationFn: (data: EstadoCHCreate) => cordobaHogarApi.createEstado(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] })
      setShowNew(false)
      setCreateError(null)
      setNewForm({ label: '', bg: '#e2e8f0', text_color: '#1e293b', orden: (estados.length + 2) * 10, aplica_juridico: true, aplica_tecnico: true, aplica_financiero: true })
    },
    onError: (err: unknown) => setCreateError(extractErrorMessage(err, 'Error al crear el estado.')),
  })

  const inp = 'border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
      <div className="bg-white rounded-lg w-[640px] max-w-[97vw] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">⚙ Parámetros — Córdoba Hogar</h3>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 pt-3 gap-1">
          {(['estados', 'parametros'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-t border-b-2 transition-colors ${
                activeTab === t
                  ? 'border-gov-navy text-gov-navy bg-slate-50'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'estados' ? 'Estados' : 'Parámetros'}
            </button>
          ))}
        </div>
        {/* Tab: Parámetros */}
        {activeTab === 'parametros' && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gov-navy mb-1">Monto por casa</p>
              <p className="text-xs text-gray-500 mb-3">
                Valor base para calcular el monto de cada localidad: <strong>cantidad de casas × monto por casa</strong>.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-semibold">$</span>
                <input
                  type="number"
                  className={`flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan`}
                  value={montoPorCasaInput}
                  onChange={(e) => setMontoPorCasaInput(e.target.value)}
                  min={0}
                />
                <button
                  onClick={() => {
                    const v = Number(montoPorCasaInput)
                    if (!v || v <= 0) { setMontoPorCasaError('Ingresá un valor positivo.'); return }
                    montoPorCasaMut.mutate(v)
                  }}
                  disabled={montoPorCasaMut.isPending}
                  className="px-4 py-1.5 text-sm text-white rounded disabled:opacity-50 hover:opacity-90 transition-colors"
                  style={{ background: 'var(--color-gov-navy)' }}
                >
                  {montoPorCasaMut.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              {montoPorCasaInput && Number(montoPorCasaInput) > 0 && (
                <p className="text-xs text-gov-cyan mt-1 font-medium">
                  = ${Number(montoPorCasaInput).toLocaleString('es-AR')} por casa
                </p>
              )}
              {montoPorCasaError && (
                <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2">{montoPorCasaError}</p>
              )}
              {montoPorCasaMut.isSuccess && (
                <p className="text-xs text-emerald-600 mt-1">✓ Guardado correctamente.</p>
              )}
            </div>
          </div>
        )}
        {/* Tab: Estados */}
        {activeTab === 'estados' && (
        <div className="p-4 space-y-2">
          {estados.map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-md overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50">
                <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: e.bg, border: `1px solid ${e.text_color}` }} />
                <span className="flex-1 text-sm font-medium">{e.label}</span>
                <span className="text-xs text-gray-400 w-10 text-right">{e.orden}</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {e.aplica_juridico && <span title="Jurídico" className="px-1 bg-purple-100 text-purple-700 rounded text-[10px]">J</span>}
                  {e.aplica_tecnico && <span title="Técnico" className="px-1 bg-blue-100 text-blue-700 rounded text-[10px]">T</span>}
                  {e.aplica_financiero && <span title="Presupuestario" className="px-1 bg-green-100 text-green-700 rounded text-[10px]">P</span>}
                </div>
                <button onClick={() => { setEditId(editId === e.id ? null : e.id); setEditSaveError(null); setEditForm({ label: e.label, bg: e.bg, text_color: e.text_color, orden: e.orden, aplica_juridico: e.aplica_juridico, aplica_tecnico: e.aplica_tecnico, aplica_financiero: e.aplica_financiero }) }} className="p-1 text-gray-400 hover:text-gov-navy rounded transition-colors" title="Editar">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => { setDeleteError((p) => { const n = { ...p }; delete n[e.id]; return n }); deleteMut.mutate(e.id) }} disabled={deleteMut.isPending} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Eliminar">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              {deleteError[e.id] && (
                <p className="px-3 py-1.5 text-xs text-red-600 bg-red-50 border-t border-red-200">{deleteError[e.id]}</p>
              )}
              {editId === e.id && (
                <div className="px-3 py-3 border-t border-slate-200 bg-white space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etiqueta</label>
                      <input className={`w-full ${inp}`} value={editForm.label ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color fondo</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={editForm.bg ?? '#e2e8f0'} onChange={(e) => setEditForm((p) => ({ ...p, bg: e.target.value }))} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                        <input className={`flex-1 ${inp} font-mono text-xs`} value={editForm.bg ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, bg: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color texto</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={editForm.text_color ?? '#1e293b'} onChange={(e) => setEditForm((p) => ({ ...p, text_color: e.target.value }))} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                        <input className={`flex-1 ${inp} font-mono text-xs`} value={editForm.text_color ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, text_color: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orden</label>
                      <input type="number" className={`w-full ${inp}`} value={editForm.orden ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, orden: Number(e.target.value) }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Aplica a</label>
                      {(['aplica_juridico', 'aplica_tecnico', 'aplica_financiero'] as const).map((flag) => (
                        <label key={flag} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={editForm[flag] ?? false} onChange={(e) => setEditForm((p) => ({ ...p, [flag]: e.target.checked }))} className="rounded" />
                          {{aplica_juridico: 'Jurídico', aplica_tecnico: 'Técnico', aplica_financiero: 'Presupuestario'}[flag]}
                        </label>
                      ))}
                    </div>
                    <div className="col-span-2 flex justify-end gap-2 pt-1">
                      <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold" style={{ background: editForm.bg ?? '#e2e8f0', color: editForm.text_color ?? '#1e293b' }}>Vista previa</span>
                    </div>
                  </div>
                  {editSaveError && (
                    <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{editSaveError}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditId(null); setEditSaveError(null) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button onClick={() => updateMut.mutate({ id: e.id, data: editForm })} disabled={updateMut.isPending} className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-colors" style={{ background: 'var(--color-gov-navy)' }}>
                      {updateMut.isPending ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {/* Nuevo estado */}
          <div className="border-2 border-dashed border-slate-300 rounded-md overflow-hidden">
            {!showNew ? (
              <button onClick={() => { setShowNew(true); setCreateError(null) }} className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gov-navy hover:bg-slate-50 transition-colors">+ Nuevo estado</button>
            ) : (
              <div className="px-3 py-3 space-y-3">
                <p className="text-xs font-bold text-gov-navy uppercase tracking-wide">Nuevo estado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etiqueta *</label>
                    <input className={`w-full ${inp}`} value={newForm.label} onChange={(e) => setNewForm((p) => ({ ...p, label: e.target.value }))} placeholder="Ej: Escritura firmada" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color fondo</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newForm.bg} onChange={(e) => setNewForm((p) => ({ ...p, bg: e.target.value }))} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                      <input className={`flex-1 ${inp} font-mono text-xs`} value={newForm.bg} onChange={(e) => setNewForm((p) => ({ ...p, bg: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color texto</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newForm.text_color} onChange={(e) => setNewForm((p) => ({ ...p, text_color: e.target.value }))} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                      <input className={`flex-1 ${inp} font-mono text-xs`} value={newForm.text_color} onChange={(e) => setNewForm((p) => ({ ...p, text_color: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orden</label>
                    <input type="number" className={`w-full ${inp}`} value={newForm.orden} onChange={(e) => setNewForm((p) => ({ ...p, orden: Number(e.target.value) }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Aplica a</label>
                    {(['aplica_juridico', 'aplica_tecnico', 'aplica_financiero'] as const).map((flag) => (
                      <label key={flag} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={newForm[flag] ?? true} onChange={(e) => setNewForm((p) => ({ ...p, [flag]: e.target.checked }))} className="rounded" />
                        {{aplica_juridico: 'Jurídico', aplica_tecnico: 'Técnico', aplica_financiero: 'Presupuestario'}[flag]}
                      </label>
                    ))}
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold" style={{ background: newForm.bg, color: newForm.text_color }}>{newForm.label || 'Vista previa'}</span>
                  </div>
                </div>
                {createError && (
                  <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{createError}</p>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => { setShowNew(false); setCreateError(null) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button onClick={() => createMut.mutate(newForm)} disabled={createMut.isPending || !newForm.label.trim()} className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-colors" style={{ background: 'var(--color-gov-navy)' }}>
                    {createMut.isPending ? 'Guardando...' : 'Crear estado'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-sm border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Agregar localidad modal ──────────────────────────────────────────────────────

function AgregarLocalidadModal({
  estados, montoPorCasa, onClose, onEditExisting,
}: {
  estados: EstadoCH[]; montoPorCasa: number; onClose: () => void
  onEditExisting: (id: string) => void
}) {
  const uid = useId()
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<LocalidadCHCreate>({ localidad: '', departamento: '', fecha_anuncio: today })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  const { data: geoList = [], isLoading: geoLoading } = useQuery({
    queryKey: ['ch-geo'],
    queryFn: cordobaHogarApi.getGeo,
  })

  const createMut = useMutation({
    mutationFn: (data: LocalidadCHCreate) => cordobaHogarApi.createLocalidad(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] })
      onClose()
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: { code?: string; existing_id?: string } } } })
        ?.response?.data?.detail
      if (detail?.code === 'LOCALIDAD_DUPLICADA' && detail.existing_id) {
        setDuplicateId(detail.existing_id)
        return
      }
      setSaveError(extractErrorMessage(err, 'Error al crear la localidad.'))
    },
  })

  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
      <div className="bg-white rounded-lg w-[560px] max-w-[97vw] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">Agregar localidad — Córdoba Hogar</h3>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-dep`} className="block text-xs font-bold text-gray-500 uppercase mb-1">Departamento *</label>
              {geoLoading
                ? <p className="text-xs text-gray-400">Cargando...</p>
                : (
                  <select
                    id={`${uid}-dep`}
                    className={inp}
                    value={form.departamento ?? ''}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, departamento: e.target.value, localidad: '' }))
                    }}
                  >
                    <option value="">— Seleccioná un departamento —</option>
                    {[...new Set(geoList.map((g) => g.departamento))].sort().map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                )}
            </div>
            <div>
              <label htmlFor={`${uid}-loc`} className="block text-xs font-bold text-gray-500 uppercase mb-1">Localidad *</label>
              <select
                id={`${uid}-loc`}
                className={inp}
                disabled={!form.departamento || geoLoading}
                value={geoList.find((g) => g.localidad === form.localidad && g.departamento === form.departamento)?.id_geo ?? ''}
                onChange={(e) => {
                  const g = geoList.find((x) => x.id_geo === e.target.value)
                  if (g) setForm((p) => ({ ...p, localidad: g.localidad, departamento: g.departamento }))
                }}
              >
                <option value="">— Seleccioná una localidad —</option>
                {geoList.filter((g) => g.departamento === form.departamento).map((g) => (
                  <option key={g.id_geo} value={g.id_geo}>{g.localidad}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-fecha`} className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha de anuncio</label>
              <input id={`${uid}-fecha`} type="date" className={inp} value={form.fecha_anuncio ?? ''} onChange={(e) => setForm((p) => ({ ...p, fecha_anuncio: e.target.value || undefined }))} />
            </div>
            <div>
              <label htmlFor={`${uid}-exp`} className="block text-xs font-bold text-gray-500 uppercase mb-1">Expediente N°</label>
              <input id={`${uid}-exp`} className={`${inp} font-mono`} value={form.expediente ?? ''} onChange={(e) => setForm((p) => ({ ...p, expediente: e.target.value }))} />
            </div>
            <div>
              <label htmlFor={`${uid}-casas`} className="block text-xs font-bold text-gray-500 uppercase mb-1">Cant. casas</label>
              <input
                id={`${uid}-casas`}
                type="number"
                className={inp}
                value={form.cantidad_casas ?? ''}
                onChange={(e) => {
                  const casas = e.target.value ? Number(e.target.value) : undefined
                  setForm((p) => ({
                    ...p,
                    cantidad_casas: casas,
                    monto: casas ? casas * montoPorCasa : undefined,
                  }))
                }}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-monto`} className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto ($)</label>
              <input
                id={`${uid}-monto`}
                type="number"
                className={`${inp} bg-slate-50`}
                readOnly
                value={form.monto ?? ''}
                title="Se calcula automáticamente a partir de la cantidad de casas"
              />
              {form.cantidad_casas && form.monto ? (
                <p className="text-[11px] text-cyan-600 mt-0.5 font-medium">
                  = {form.cantidad_casas} casas × ${montoPorCasa.toLocaleString('es-AR')}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor={`${uid}-ok`} className="block text-xs font-bold text-gray-500 uppercase mb-1">OK Ministerio</label>
              <select id={`${uid}-ok`} className={inp} value={form.ok_gob ?? 'SI'} onChange={(e) => setForm((p) => ({ ...p, ok_gob: e.target.value }))}>
                <option>SI</option><option>NO</option><option>En trámite</option>
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gov-navy">Estados por Dimensión (opcional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['ejuridico', 'etecnico', 'efinanciero'] as const).map((field) => (
                <div key={field} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <label htmlFor={`${uid}-${field}`} className="block text-xs font-bold uppercase mb-2 text-gov-navy">{CAMPO_LABELS[field]}</label>
                  <select id={`${uid}-${field}`} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan" value={form[field] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value ? Number(e.target.value) : undefined }))}>
                    <option value="">—</option>
                    {estados.filter((e) => field === 'ejuridico' ? e.aplica_juridico : field === 'etecnico' ? e.aplica_tecnico : e.aplica_financiero)
                      .map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          {saveError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</p>}
          {duplicateId && (
            <div role="alert" className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded px-3 py-2.5">
              <p className="text-xs text-amber-800 font-medium">
                Esta localidad ya existe en el panel.
              </p>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setDuplicateId(null)}
                  className="px-3 py-1 text-xs rounded border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onEditExisting(duplicateId)}
                  className="px-3 py-1 text-xs rounded text-white hover:opacity-90 transition-colors"
                  style={{ background: 'var(--color-gov-navy)' }}
                >
                  Ir a editar
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-sm border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.localidad.trim()} className="px-5 py-1.5 rounded text-sm text-white disabled:opacity-50 transition-colors hover:opacity-90" style={{ background: 'var(--color-gov-navy)' }}>
            {createMut.isPending ? 'Guardando...' : 'Agregar localidad'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────────

export function CordobaHogarPage() {
  const queryClient = useQueryClient()
  const { data: user } = usePortalUser()
  const canManage = user?.rol === 'Supervisor' || user?.rol === 'Admin'
  const canEdit = canManage || user?.rol === 'Operador'

  const searchId = useId()
  const deptoId = useId()
  const okId = useId()
  const egId = useId()

  const [search, setSearch] = useState('')
  const [deptoFilter, setDeptoFilter] = useState('')
  const [okFilter, setOkFilter] = useState('')
  const [egFilter, setEgFilter] = useState('')
  const [editTarget, setEditTarget] = useState<LocalidadCH | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<LocalidadCH | null>(null)
  const [showGestionarEstados, setShowGestionarEstados] = useState(false)
  const [showAgregar, setShowAgregar] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cordoba-hogar'],
    queryFn: cordobaHogarApi.getPanel,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, upd }: { id: string; upd: LocalidadCHUpdate }) =>
      cordobaHogarApi.updateLocalidad(id, upd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] })
      setEditTarget(null)
      setEditError(null)
    },
    onError: (err: unknown) => setEditError(extractErrorMessage(err, 'Error al guardar los cambios.')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => cordobaHogarApi.deleteLocalidad(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cordoba-hogar'] })
      setConfirmDeleteId(null)
      setDetailTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err, 'Error al eliminar el registro.')),
  })

  const localidades = data?.localidades ?? []
  const estados = data?.estados ?? []
  const presupuesto = data?.presupuesto ?? 0
  const montoPorCasa = data?.monto_por_casa ?? 34000000

  const { data: geoForFilter = [] } = useQuery({
    queryKey: ['ch-geo'],
    queryFn: cordobaHogarApi.getGeo,
  })

  const deptos = useMemo(
    () => [...new Set(geoForFilter.map((g) => g.departamento))].sort(),
    [geoForFilter]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return localidades.filter((l) => {
      if (q && !`${l.localidad} ${l.expediente ?? ''} ${l.doc_exp ?? ''}`.toLowerCase().includes(q)) return false
      if (deptoFilter && l.departamento !== deptoFilter) return false
      if (okFilter && l.ok_gob !== okFilter) return false
      if (egFilter && String(l.estado_general) !== egFilter) return false
      return true
    })
  }, [localidades, search, deptoFilter, okFilter, egFilter])

  const montoTotal = localidades.reduce((s, l) => s + (l.monto ?? 0), 0)
  const saldo = montoTotal - presupuesto
  const totalCasas = localidades.reduce((s, l) => s + (l.cantidad_casas ?? 0), 0)
  const conOkGob = localidades.filter((l) => l.ok_gob === 'SI').length
  const conConvenio = localidades.filter((l) => {
    const e = estados.find((s) => s.id === l.ejuridico)
    return e?.label === 'Convenio Firmado'
  }).length
  const hasFilters = !!(search || deptoFilter || okFilter || egFilter)

  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    setSortDir((prev) => (sortCol === key && prev === 'asc' ? 'desc' : 'asc'))
    setSortCol(key)
  }

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const dir = sortDir === 'asc' ? 1 : -1
    const ESTADO_KEYS = ['ejuridico', 'etecnico', 'efinanciero', 'estado_general']
    return [...filtered].sort((a, b) => {
      let va: string | number | null
      let vb: string | number | null
      if (sortCol === 'avance') {
        va = avancePct(a, estados); vb = avancePct(b, estados)
      } else if (ESTADO_KEYS.includes(sortCol)) {
        const keyA = (a as unknown as Record<string, unknown>)[sortCol] as number | null
        const keyB = (b as unknown as Record<string, unknown>)[sortCol] as number | null
        va = estados.find((e) => e.id === keyA)?.orden ?? null
        vb = estados.find((e) => e.id === keyB)?.orden ?? null
      } else {
        va = ((a as unknown as Record<string, unknown>)[sortCol] as string | number | null) ?? null
        vb = ((b as unknown as Record<string, unknown>)[sortCol] as string | number | null) ?? null
      }
      if (va === null && vb === null) return 0
      if (va === null) return dir
      if (vb === null) return -dir
      if (typeof va === 'string') return dir * va.localeCompare(vb as string, 'es')
      return dir * (va - (vb as number))
    })
  }, [filtered, sortCol, sortDir, estados])

  if (isLoading) return <p role="status" aria-live="polite" className="text-center py-12 text-gray-500">Cargando...</p>
  if (error) return <p role="alert" className="text-red-600 py-4">Error al cargar el panel.</p>

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gov-cyan mb-1">Programa Provincial — Secretaría de Vivienda</p>
        <h2 className="text-xl font-bold text-gov-navy">Córdoba Hogar</h2>
        <p className="text-xs text-gray-400 mt-0.5">Versión provisoria — sujeto a modificaciones post reunión con el área</p>
      </div>

      {/* KPI cards */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: 'Localidades', value: String(localidades.length), color: 'var(--color-gov-navy)' },
          { label: 'Viviendas', value: String(totalCasas), color: 'var(--color-gov-blue)' },
          { label: 'Monto Total', value: fmtMontoResumen(montoTotal), color: 'var(--color-gov-cyan)' },
          { label: 'OK Ministerio', value: String(conOkGob), color: '#22c55e' },
          { label: 'Convenio Firmado', value: String(conConvenio), color: 'var(--color-gov-navy)' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-md px-4 py-3 min-w-[140px] shadow-sm border border-slate-100" style={{ borderTop: `4px solid ${c.color}` }}>
            <div className="text-2xl font-bold leading-none" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{c.label}</div>
          </div>
        ))}
        {presupuesto > 0 && (
          <div className="bg-white rounded-md px-4 py-3 min-w-[160px] shadow-sm border border-slate-100" style={{ borderTop: '4px solid #01aae3' }}>
            <div className="text-lg font-bold leading-none text-gov-cyan">{fmtMontoResumen(presupuesto)}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Crédito Asignado</div>
            <div className="text-xs font-bold mt-0.5" style={{ color: saldo >= 0 ? '#22c55e' : '#ef4444' }}>
              Saldo: {fmtMontoResumen(Math.abs(saldo))}{saldo < 0 ? ' (déficit)' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Barra de acciones */}
      <div className="flex items-center gap-2 mb-2 justify-end">
        <button
          onClick={() => {
            const rows = sorted.map((l) => ({
              '#': l.orden,
              'Localidad': l.localidad,
              'Departamento': l.departamento ?? '',
              'Fecha anuncio': l.fecha_anuncio ?? '',
              'Expediente N°': l.expediente ?? '',
              'Casas': l.cantidad_casas ?? '',
              'Monto ($)': l.monto ?? '',
              'OK Ministro': l.ok_gob,
              'Última obs.': l.doc_exp ?? '',
              'Últ. modif.': fmtDate(l.updated_at),
              'Estado General': estados.find((e) => e.id === l.estado_general)?.label ?? '',
              'Est. Jurídico': estados.find((e) => e.id === l.ejuridico)?.label ?? '',
              'Est. Técnico': estados.find((e) => e.id === l.etecnico)?.label ?? '',
              'Est. Presup.': estados.find((e) => e.id === l.efinanciero)?.label ?? '',
              'Avance (%)': avancePct(l, estados),
              'Observaciones': l.obs ?? '',
            }))
            exportToXlsx(rows, 'Córdoba Hogar', `cordoba_hogar_${new Date().toISOString().split('T')[0]}.xlsx`)
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50 transition-colors"
          title={`Exportar ${sorted.length} filas a Excel`}
        >
          ↓ Exportar ({sorted.length})
        </button>
        {canEdit && (
          <button
            onClick={() => setShowAgregar(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-gov-cyan text-gov-cyan hover:bg-sky-50 transition-colors"
          >
            + Agregar localidad
          </button>
        )}
        {canManage && (
          <button
            onClick={() => setShowGestionarEstados(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 text-gray-600 hover:bg-slate-50 transition-colors"
            title="Gestionar parámetros y estados"
          >
            ⚙ Parámetros
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-t-md px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor={searchId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Buscar</label>
          <input id={searchId} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Localidad, expediente, observaciones..." className="border border-slate-200 rounded px-2 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={deptoId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Depto.</label>
          <select id={deptoId} value={deptoFilter} onChange={(e) => setDeptoFilter(e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            {deptos.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={okId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">OK Ministro</label>
          <select id={okId} value={okFilter} onChange={(e) => setOkFilter(e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={egId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Est. General</label>
          <select id={egId} value={egFilter} onChange={(e) => setEgFilter(e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
            <option value="">— Todos —</option>
            {estados.map((e) => <option key={e.id} value={String(e.id)}>{e.label}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setDeptoFilter(''); setOkFilter(''); setEgFilter('') }} className="border border-slate-200 rounded px-3 py-1 text-xs font-bold text-gray-600 hover:bg-slate-50 transition-colors">
            ✕ Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'localidad' : 'localidades'}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-b-md shadow-sm border border-t-0 border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <span className="text-xs font-bold text-gov-navy">Convenios con Localidades — Provincia de Córdoba</span>
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
        <div className="overflow-x-auto" role="region" aria-label="Tabla de localidades">
          <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--color-gov-navy)', color: '#fff' }}>
                <th scope="col" style={S1_HEAD} className="px-2.5 py-2 text-left font-semibold cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('orden')}>
                  <span className="flex items-center gap-0.5">#<span className="text-sky-300/70 text-[9px] ml-0.5">{sortCol === 'orden' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></span>
                </th>
                <th scope="col" style={S2_HEAD} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort('localidad')}>
                  <span className="flex items-center gap-0.5">Localidad<span className="text-sky-300/70 text-[9px] ml-0.5">{sortCol === 'localidad' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></span>
                </th>
                {CH_COLS.map(({ label, sort }) => (
                  <th
                    key={Array.isArray(label) ? label.join('-') : label}
                    scope="col"
                    className={`px-2.5 py-2 text-left font-semibold whitespace-nowrap select-none${sort ? ' cursor-pointer hover:bg-white/10' : ''}`}
                    style={{ fontSize: '11px' }}
                    onClick={() => sort && handleSort(sort)}
                  >
                    <span className="flex items-center gap-0.5">
                      <span>{Array.isArray(label) ? <>{label[0]}<br />{label[1]}</> : label}</span>
                      {sort && <span className="text-sky-300/70 text-[9px] ml-0.5">{sortCol === sort ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={16} className="text-center py-10 text-gray-400">Sin resultados para los filtros aplicados.</td>
                </tr>
              )}
              {sorted.map((l) => {
                const pct = avancePct(l, estados)
                const col = avanceColor(pct)
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition-colors">
                    <td style={S1_BODY} className="px-2.5 py-1.5 text-gray-400 text-center">{l.orden}</td>
                    <td style={S2_BODY} className="p-0 font-bold">
                      <button
                        onClick={() => setDetailTarget(l)}
                        className="w-full px-2.5 py-1.5 text-left font-bold hover:text-gov-cyan transition-colors group"
                        title="Ver historial"
                      >
                        {l.localidad}
                        <span className="block text-[9px] font-normal text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity leading-none">Ver historial</span>
                      </button>
                    </td>
                    <td className="px-2.5 py-1.5">
                      {l.departamento && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: '#E8EAF6', color: '#283593' }}>{l.departamento}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-gray-600 whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtFecha(l.fecha_anuncio)}</td>
                    <td className="px-2.5 py-1.5 font-mono text-gray-600" style={{ fontSize: '11px' }}>{l.expediente || '—'}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-center" style={{ fontSize: '11px' }}>{l.cantidad_casas ?? '—'}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gov-blue whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(l.monto)}</td>
                    <td className="px-2.5 py-1.5"><OkBadge v={l.ok_gob} /></td>
                    <td className="px-2.5 py-1.5" style={{ fontSize: '10px' }}>
                      {l.doc_exp
                        ? <span className="rounded px-1.5 py-0.5" style={{ background: '#E3F2FD', color: '#1565C0', fontSize: '10px' }}>📄 {l.doc_exp}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2.5 py-1.5 text-gray-400 whitespace-nowrap" style={{ fontSize: '10px' }}>
                      {fmtDate(l.updated_at)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <EstadoBadge id={l.estado_general} estados={estados} />
                    </td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={l.ejuridico} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={l.etecnico} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={l.efinanciero} estados={estados} /></td>
                    <td className="px-2.5 py-1.5 min-w-[90px]">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance ${pct}%`}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                        </div>
                        <span className="text-gray-500 w-7 text-right" style={{ fontSize: '11px' }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <button onClick={() => setDetailTarget(l)} className="p-1 rounded text-gray-500 hover:text-gov-cyan hover:bg-sky-50 transition-colors" aria-label={`Ver historial de ${l.localidad}`} title="Ver historial / comunicaciones">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </button>
                      {canEdit && (
                        <button onClick={() => { setEditTarget(l); setEditError(null) }} className="p-1 rounded text-gray-500 hover:text-gov-navy hover:bg-sky-50 transition-colors ml-0.5" aria-label={`Editar ${l.localidad}`} title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      )}
                      {canManage && (
                        <>
                          {confirmDeleteId === l.id ? (
                            <span className="inline-flex flex-col items-end gap-1 ml-0.5">
                              <span className="inline-flex items-center gap-1">
                                <button onClick={() => deleteMut.mutate(l.id)} disabled={deleteMut.isPending} className="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 transition-colors">{deleteMut.isPending ? '...' : 'Sí'}</button>
                                <button onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }} className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">No</button>
                              </span>
                              {deleteError && confirmDeleteId === l.id && (
                                <span role="alert" className="text-[10px] text-red-600 whitespace-nowrap">{deleteError}</span>
                              )}
                            </span>
                          ) : (
                            <button onClick={() => { setConfirmDeleteId(l.id); setDeleteError(null) }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5" aria-label={`Eliminar ${l.localidad}`} title="Eliminar">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
          localidad={editTarget}
          estados={estados}
          isSaving={updateMut.isPending}
          saveError={editError}
          onClose={() => { setEditTarget(null); setEditError(null) }}
          onSave={(upd) => updateMut.mutate({ id: editTarget.id, upd })}
        />
      )}
      {detailTarget && (
        <DetailPanel
          localidad={detailTarget}
          estados={estados}
          onClose={() => setDetailTarget(null)}
        />
      )}
      {showGestionarEstados && canManage && (
        <GestionarParametrosModal estados={estados} montoPorCasa={montoPorCasa} onClose={() => setShowGestionarEstados(false)} />
      )}
      {showAgregar && (
        <AgregarLocalidadModal
          estados={estados}
          montoPorCasa={montoPorCasa}
          onClose={() => setShowAgregar(false)}
          onEditExisting={(id) => {
            setShowAgregar(false)
            const localidad = localidades.find((l) => l.id === id)
            if (localidad) { setEditTarget(localidad); setEditError(null) }
          }}
        />
      )}
    </div>
  )
}
