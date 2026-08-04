import { useState, useMemo, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { miLugarApi } from '../api/vivienda.api'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import type {
  EstadoML, ProyectoML, ProyectoMLUpdate, ProyectoMLCreate,
  EstadoHistorialML, PedidoML, TipoProyectoML, ConfigML, GeoPuntoMLCreate,
} from '../types/vivienda.types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonto(n: number | null) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-AR')
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
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
        return field ? `Campo "${field}": ${e.msg ?? 'valor inválido.'}` : (e.msg ?? 'Error de validación.')
      })
      .join(' ')
  }
  if (detail) return JSON.stringify(detail)
  return fallback
}

function avancePct(p: ProyectoML, estados: EstadoML[]) {
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

const TIPO_CONFIG: Record<TipoProyectoML, { label: string; color: string; textColor: string }> = {
  exp:  { label: 'Expropiaciones',       color: '#B03A2E', textColor: '#fff' },
  muni: { label: 'Convenios Municipios', color: '#1E8449', textColor: '#fff' },
  prov: { label: 'Lotes Provinciales',   color: '#1A5276', textColor: '#fff' },
}

const CAMPO_LABELS: Record<string, string> = {
  ejuridico: 'Jurídico',
  etecnico: 'Técnico',
  efinanciero: 'Presupuestario',
}

// ── Sticky column styles ──────────────────────────────────────────────────────

const S1_HEAD = { position: 'sticky' as const, left: 0, zIndex: 3, background: 'var(--color-gov-navy)', minWidth: 36, width: 36 }
const S2_HEAD = { position: 'sticky' as const, left: 36, zIndex: 3, background: 'var(--color-gov-navy)', minWidth: 180 }
const S1_BODY = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#f8fafc', minWidth: 36, width: 36 }
const S2_BODY = { position: 'sticky' as const, left: 36, zIndex: 2, background: '#f8fafc', minWidth: 180, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)' }

// ── EstadoBadge ───────────────────────────────────────────────────────────────

function EstadoBadge({ id, estados }: { id: number | null; estados: EstadoML[] }) {
  const e = estados.find((s) => s.id === id)
  if (!e) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap max-w-[140px] truncate"
      style={{ background: e.bg, color: e.text_color }} title={e.label}>
      {e.label}
    </span>
  )
}

// ── Geo link helper ───────────────────────────────────────────────────────────

function GeoLinks({ puntos }: { puntos: ProyectoML['geo_puntos'] }) {
  if (!puntos.length) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="flex flex-wrap gap-0.5">
      {puntos.map((p, i) => (
        <a key={p.id}
          href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
          target="_blank" rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs whitespace-nowrap">
          📍 {puntos.length === 1 ? 'Ver en Maps' : `Punto ${i + 1}`}
        </a>
      ))}
    </span>
  )
}

// ── Panel lateral ─────────────────────────────────────────────────────────────

function SidePanel({
  proyecto, estados, onClose, canWrite,
}: {
  proyecto: ProyectoML; estados: EstadoML[]; onClose: () => void; canWrite: boolean
}) {
  const [tab, setTab] = useState<'historial' | 'pedidos'>('historial')
  const [newPedido, setNewPedido] = useState('')
  const [newFecha, setNewFecha] = useState(new Date().toISOString().split('T')[0])
  const qc = useQueryClient()

  const histQuery = useQuery({
    queryKey: ['ml-historial', proyecto.id],
    queryFn: () => miLugarApi.getHistorial(proyecto.id),
  })
  const pedidosQuery = useQuery({
    queryKey: ['ml-pedidos', proyecto.id],
    queryFn: () => miLugarApi.getPedidos(proyecto.id),
  })

  const createPedido = useMutation({
    mutationFn: (data: { descripcion: string; fecha_pedido: string }) =>
      miLugarApi.createPedido(proyecto.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-pedidos', proyecto.id] })
      setNewPedido('')
    },
  })
  const deletePedido = useMutation({
    mutationFn: (pedidoId: string) => miLugarApi.deletePedido(proyecto.id, pedidoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ml-pedidos', proyecto.id] }),
  })

  const BADGE_SECRETARIA: Record<string, string> = {
    infraestructura: 'bg-indigo-100 text-indigo-800',
    supervision: 'bg-violet-100 text-violet-800',
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex">
      <div className="flex-1 bg-slate-900/30" onClick={onClose} />
      <aside className="w-[420px] max-w-[95vw] bg-white shadow-2xl flex flex-col h-full">
        <div className="text-white px-4 py-3 flex items-center gap-3" style={{ background: 'var(--color-gov-navy)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-sky-300 font-semibold uppercase tracking-wider">
              {TIPO_CONFIG[proyecto.tipo].label}
            </p>
            <h3 className="font-semibold text-sm truncate">{proyecto.nombre}</h3>
            <p className="text-white/50 text-xs truncate">{proyecto.localidad_nombre}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sky-300 hover:text-white text-xl" aria-label="Cerrar">✕</button>
        </div>
        <div className="flex border-b border-slate-100">
          {(['historial', 'pedidos'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === t ? 'text-gov-navy border-b-2 border-gov-navy bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'historial' ? 'Historial de estados' : 'Comunicaciones'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'historial' && (
            histQuery.isLoading ? <p className="text-xs text-gray-400">Cargando...</p> :
            !histQuery.data?.length ? <p className="text-xs text-gray-400">Sin cambios registrados.</p> :
            <div className="space-y-2">
              {histQuery.data.map((h: EstadoHistorialML) => {
                const ant = estados.find((e) => e.id === h.estado_anterior_id)
                const nuevo = estados.find((e) => e.id === h.estado_nuevo_id)
                return (
                  <div key={h.id} className="text-xs border border-slate-100 rounded p-2.5 bg-slate-50">
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-600">{CAMPO_LABELS[h.campo] ?? h.campo}</span>
                      {ant && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: ant.bg, color: ant.text_color }}>{ant.label}</span>}
                      <span className="text-gray-400">→</span>
                      {nuevo && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: nuevo.bg, color: nuevo.text_color }}>{nuevo.label}</span>}
                    </div>
                    <p className="text-gray-400">{fmtTs(h.created_at)} · {h.created_by ?? '—'}</p>
                  </div>
                )
              })}
            </div>
          )}
          {tab === 'pedidos' && (
            <div className="space-y-3">
              {canWrite && (
                <div className="border border-sky-200 rounded p-3 bg-sky-50 space-y-2">
                  <textarea
                    value={newPedido}
                    onChange={(e) => setNewPedido(e.target.value)}
                    placeholder="Nueva actualización..."
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                    rows={3}
                  />
                  <div className="flex gap-2 items-center">
                    <input type="date" value={newFecha} onChange={(e) => setNewFecha(e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan" />
                    <button type="button"
                      disabled={!newPedido.trim() || createPedido.isPending}
                      onClick={() => createPedido.mutate({ descripcion: newPedido.trim(), fecha_pedido: newFecha })}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-gov-navy text-white hover:bg-gov-blue disabled:opacity-40 transition-colors">
                      {createPedido.isPending ? '...' : '+ Agregar'}
                    </button>
                  </div>
                </div>
              )}
              {pedidosQuery.isLoading ? <p className="text-xs text-gray-400">Cargando...</p> :
               !pedidosQuery.data?.length ? <p className="text-xs text-gray-400">Sin comunicaciones.</p> :
               pedidosQuery.data.map((p: PedidoML) => (
                <div key={p.id} className="text-xs border border-slate-100 rounded p-2.5 bg-slate-50 relative group">
                  {p.secretaria && (
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold mb-1 ${BADGE_SECRETARIA[p.secretaria] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.secretaria.charAt(0).toUpperCase() + p.secretaria.slice(1)}
                    </span>
                  )}
                  <p className="text-gray-700 whitespace-pre-wrap">{p.descripcion}</p>
                  <p className="text-gray-400 mt-1">{fmtDate(p.fecha_pedido)} · {p.created_by_nombre ?? p.created_by ?? '—'}</p>
                  {canWrite && (
                    <button type="button"
                      onClick={() => { if (confirm('¿Eliminar esta entrada?')) deletePedido.mutate(p.id) }}
                      className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-base">
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
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
  const lotesPorHa = config?.lotes_por_ha ?? 25
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
  const [geoText, setGeoText] = useState(
    proyecto.geo_puntos.map((p) => `${p.lat},${p.lng}`).join('\n')
  )

  const set = <K extends keyof ProyectoMLUpdate>(k: K, v: ProyectoMLUpdate[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const calcLotesAuto = form.superficie != null ? Math.round(Number(form.superficie) * lotesPorHa) : null
  const lotesMatchAuto = calcLotesAuto != null && form.lotes === calcLotesAuto

  const lbl = 'block text-xs font-bold text-gray-500 uppercase mb-1'
  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'
  const sel = inp

  const tieneFinanciero = proyecto.tipo === 'exp' || proyecto.tipo === 'prov'

  function parseGeoText(text: string): GeoPuntoMLCreate[] {
    return text.split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [lat, lng] = l.split(',').map((s) => parseFloat(s.trim()))
        return isNaN(lat) || isNaN(lng) ? null : { lat, lng }
      })
      .filter((p): p is GeoPuntoMLCreate => p !== null)
  }

  function handleSubmit() {
    const geosParsed = parseGeoText(geoText)
    onSave({ ...form, geo_puntos: geosParsed })
  }

  const ESTADOS_JURIDICO = estados.filter((e) => e.aplica_juridico)
  const ESTADOS_TECNICO = estados.filter((e) => e.aplica_tecnico)
  const ESTADOS_FINANCIERO = estados.filter((e) => e.aplica_financiero)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={onClose}>
      <div className="bg-white rounded-lg w-[780px] max-w-[97vw] max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 id={`${uid}-t`} className="flex-1 font-semibold text-sm">Editar — {proyecto.nombre}</h3>
          <button type="button" onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-5">

          {/* Datos básicos */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Datos básicos</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor={`${uid}-nom`} className={lbl}>Nombre / Denominación *</label>
                <input id={`${uid}-nom`} className={inp} value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-loc`} className={lbl}>Localidad *</label>
                <input id={`${uid}-loc`} className={inp} value={form.localidad_nombre ?? ''} onChange={(e) => set('localidad_nombre', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-dep`} className={lbl}>Departamento</label>
                <input id={`${uid}-dep`} className={inp} value={form.departamento ?? ''} onChange={(e) => set('departamento', e.target.value || null)} />
              </div>
              <div>
                <label htmlFor={`${uid}-exp`} className={lbl}>Expediente</label>
                <input id={`${uid}-exp`} className={inp} value={form.expediente ?? ''} onChange={(e) => set('expediente', e.target.value || null)} />
              </div>
              <div>
                <label htmlFor={`${uid}-res`} className={lbl}>Responsable</label>
                <input id={`${uid}-res`} className={inp} value={form.responsable ?? ''} onChange={(e) => set('responsable', e.target.value || null)} />
              </div>
              <div>
                <label htmlFor={`${uid}-okgob`} className={lbl}>OK Gobernación</label>
                <select id={`${uid}-okgob`} className={sel} value={form.ok_gob ?? 'SI'} onChange={(e) => set('ok_gob', e.target.value)}>
                  <option>SI</option><option>NO</option><option>PENDIENTE</option>
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor={`${uid}-obs`} className={lbl}>Observaciones</label>
                <textarea id={`${uid}-obs`} className={inp} rows={2} value={form.obs ?? ''} onChange={(e) => set('obs', e.target.value || null)} />
              </div>
            </div>
          </div>

          {/* Superficie y lotes */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Superficie y lotes</p>
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
                  {lotesMatchAuto && (
                    <span className="ml-2 text-[10px] text-cyan-600 font-medium normal-case">
                      = {form.superficie} Ha × {lotesPorHa} lotes/Ha
                    </span>
                  )}
                </label>
                <input id={`${uid}-lot`} type="number" className={inp}
                  value={form.lotes ?? ''} onChange={(e) => set('lotes', e.target.value === '' ? null : parseInt(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Financiero */}
          {tieneFinanciero && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Datos financieros</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${uid}-monto`} className={lbl}>Monto ($)</label>
                  <input id={`${uid}-monto`} type="number" className={inp}
                    value={form.monto ?? ''} onChange={(e) => set('monto', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
                {proyecto.tipo === 'exp' && (
                  <div>
                    <label htmlFor={`${uid}-vf`} className={lbl}>Valor Fiscal ($)</label>
                    <input id={`${uid}-vf`} type="number" className={inp}
                      value={form.valor_fiscal ?? ''} onChange={(e) => set('valor_fiscal', e.target.value === '' ? null : parseFloat(e.target.value))} />
                  </div>
                )}
                <div>
                  <label htmlFor={`${uid}-isn`} className={lbl}>INFRA SIN NEXOS ($)</label>
                  <input id={`${uid}-isn`} type="number" className={inp}
                    value={form.infra_sin_nexos ?? ''} onChange={(e) => set('infra_sin_nexos', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
                <div>
                  <label htmlFor={`${uid}-nex`} className={lbl}>Costo de NEXOS ($)</label>
                  <input id={`${uid}-nex`} type="number" className={inp}
                    value={form.costo_nexos ?? ''} onChange={(e) => set('costo_nexos', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
                <div>
                  <label htmlFor={`${uid}-unc`} className={lbl}>Convenio UNC ($)</label>
                  <input id={`${uid}-unc`} type="number" className={inp}
                    value={form.convenio_unc ?? ''} onChange={(e) => set('convenio_unc', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
                <div>
                  <label htmlFor={`${uid}-cti`} className={lbl}>COSTO TOTAL INFRA ($)</label>
                  <input id={`${uid}-cti`} type="number" className={inp}
                    value={form.costo_total_infra ?? ''} onChange={(e) => set('costo_total_infra', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
              </div>
            </div>
          )}
          {!tieneFinanciero && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Datos financieros</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${uid}-monto`} className={lbl}>Monto ($)</label>
                  <input id={`${uid}-monto`} type="number" className={inp}
                    value={form.monto ?? ''} onChange={(e) => set('monto', e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
              </div>
            </div>
          )}

          {/* Estados por dimensión */}
          <div>
            <div className="flex items-center gap-3 mb-3 border-b pb-1">
              <p className="text-xs font-bold text-gray-400 uppercase">Estados por Dimensión</p>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Fecha del cambio</label>
                <input type="date" max={today} className="border border-slate-200 rounded px-2 py-1 text-xs"
                  value={form.fecha_cambio ?? today} onChange={(e) => set('fecha_cambio', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ejuridico', label: 'Estado Jurídico-Adm.', opts: ESTADOS_JURIDICO },
                { key: 'etecnico', label: 'Estado Técnico', opts: ESTADOS_TECNICO },
                { key: 'efinanciero', label: 'Estado Presup./Fin.', opts: ESTADOS_FINANCIERO },
                { key: 'estado_general', label: 'Estado General (manual)', opts: estados },
              ].map(({ key, label, opts }) => (
                <div key={key}>
                  <label htmlFor={`${uid}-${key}`} className={lbl}>{label}</label>
                  <select id={`${uid}-${key}`} className={sel}
                    value={(form as Record<string, unknown>)[key] as number ?? ''}
                    onChange={(e) => set(key as keyof ProyectoMLUpdate, e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">— Sin estado —</option>
                    {opts.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Geolocalización */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Geolocalización (puntos del predio)</p>
            <p className="text-xs text-gray-400 mb-2">Una coordenada por línea en formato <code>lat,lng</code></p>
            <textarea
              className={inp + ' font-mono text-xs'}
              rows={4}
              value={geoText}
              onChange={(e) => setGeoText(e.target.value)}
              placeholder={'-31.292807,-64.177675\n-31.289985,-64.179777'}
            />
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{saveError}</div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button type="button" disabled={isSaving || !form.nombre?.trim()} onClick={handleSubmit}
              className="text-xs px-4 py-2 rounded bg-gov-navy text-white font-semibold hover:bg-gov-blue disabled:opacity-40 transition-colors">
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de alta ─────────────────────────────────────────────────────────────

function CreateModal({
  tipo, config, onSave, onClose, isSaving, saveError,
}: {
  tipo: TipoProyectoML; config: ConfigML | null
  onSave: (data: ProyectoMLCreate) => void; onClose: () => void
  isSaving: boolean; saveError?: string | null
}) {
  const lotesPorHa = config?.lotes_por_ha ?? 25
  const [form, setForm] = useState<Partial<ProyectoMLCreate>>({
    tipo, nombre: '', localidad_nombre: '', ok_gob: 'SI', geo_puntos: [],
  })
  const [geoText, setGeoText] = useState('')
  const set = <K extends keyof ProyectoMLCreate>(k: K, v: ProyectoMLCreate[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const calcLotesAuto = form.superficie != null ? Math.round(Number(form.superficie) * lotesPorHa) : null
  const lotesMatchAuto = calcLotesAuto != null && form.lotes === calcLotesAuto

  const lbl = 'block text-xs font-bold text-gray-500 uppercase mb-1'
  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

  function parseGeoText(text: string) {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [lat, lng] = l.split(',').map((s) => parseFloat(s.trim()))
      return isNaN(lat) || isNaN(lng) ? null : { lat, lng }
    }).filter((p): p is { lat: number; lng: number } => p !== null)
  }

  function handleSubmit() {
    if (!form.nombre?.trim() || !form.localidad_nombre?.trim()) return
    onSave({
      tipo: form.tipo!,
      nombre: form.nombre.trim(),
      localidad_nombre: form.localidad_nombre.trim(),
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
      ejuridico: form.ejuridico,
      etecnico: form.etecnico,
      efinanciero: form.efinanciero,
      estado_general: form.estado_general,
      obs: form.obs || undefined,
      geo_puntos: parseGeoText(geoText),
    })
  }

  const tieneFinanciero = tipo === 'exp' || tipo === 'prov'
  const tipoLabel = TIPO_CONFIG[tipo].label

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-white rounded-lg w-[780px] max-w-[97vw] max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: TIPO_CONFIG[tipo].color }}>
          <h3 className="flex-1 font-semibold text-sm">+ Nuevo proyecto — {tipoLabel}</h3>
          <button type="button" onClick={onClose} className="hover:opacity-70 text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Datos básicos</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Nombre / Denominación *</label>
                <input className={inp} value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} autoFocus />
              </div>
              <div>
                <label className={lbl}>Localidad *</label>
                <input className={inp} value={form.localidad_nombre ?? ''} onChange={(e) => set('localidad_nombre', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Departamento</label>
                <input className={inp} value={form.departamento ?? ''} onChange={(e) => set('departamento', e.target.value || undefined)} />
              </div>
              <div>
                <label className={lbl}>Expediente</label>
                <input className={inp} value={form.expediente ?? ''} onChange={(e) => set('expediente', e.target.value || undefined)} />
              </div>
              <div>
                <label className={lbl}>Responsable</label>
                <input className={inp} value={form.responsable ?? ''} onChange={(e) => set('responsable', e.target.value || undefined)} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Superficie y lotes</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Superficie (Ha)</label>
                <input type="number" step="0.0001" className={inp} value={form.superficie ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                    set('superficie', v)
                    if (v != null) set('lotes', Math.round(v * lotesPorHa))
                  }} />
              </div>
              <div>
                <label className={lbl}>
                  Lotes
                  {lotesMatchAuto && (
                    <span className="ml-2 text-[10px] text-cyan-600 font-medium normal-case">
                      = {form.superficie} Ha × {lotesPorHa} lotes/Ha
                    </span>
                  )}
                </label>
                <input type="number" className={inp} value={form.lotes ?? ''}
                  onChange={(e) => set('lotes', e.target.value === '' ? undefined : parseInt(e.target.value))} />
              </div>
            </div>
          </div>

          {tieneFinanciero && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Datos financieros</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Monto ($)</label>
                  <input type="number" className={inp} value={form.monto ?? ''}
                    onChange={(e) => set('monto', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
                {tipo === 'exp' && (
                  <div>
                    <label className={lbl}>Valor Fiscal ($)</label>
                    <input type="number" className={inp} value={form.valor_fiscal ?? ''}
                      onChange={(e) => set('valor_fiscal', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                  </div>
                )}
                <div>
                  <label className={lbl}>INFRA SIN NEXOS ($)</label>
                  <input type="number" className={inp} value={form.infra_sin_nexos ?? ''}
                    onChange={(e) => set('infra_sin_nexos', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
                <div>
                  <label className={lbl}>Costo NEXOS ($)</label>
                  <input type="number" className={inp} value={form.costo_nexos ?? ''}
                    onChange={(e) => set('costo_nexos', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
                <div>
                  <label className={lbl}>Convenio UNC ($)</label>
                  <input type="number" className={inp} value={form.convenio_unc ?? ''}
                    onChange={(e) => set('convenio_unc', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
                <div>
                  <label className={lbl}>COSTO TOTAL INFRA ($)</label>
                  <input type="number" className={inp} value={form.costo_total_infra ?? ''}
                    onChange={(e) => set('costo_total_infra', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
              </div>
            </div>
          )}

          {!tieneFinanciero && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Datos financieros</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Monto ($)</label>
                  <input type="number" className={inp} value={form.monto ?? ''}
                    onChange={(e) => set('monto', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Geolocalización</p>
            <p className="text-xs text-gray-400 mb-2">Una coordenada por línea en formato <code>lat,lng</code></p>
            <textarea className={inp + ' font-mono text-xs'} rows={3} value={geoText}
              onChange={(e) => setGeoText(e.target.value)} placeholder={'-31.292807,-64.177675'} />
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{saveError}</div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button type="button" disabled={isSaving || !form.nombre?.trim() || !form.localidad_nombre?.trim()} onClick={handleSubmit}
              className="text-xs px-4 py-2 rounded text-white font-semibold hover:opacity-80 disabled:opacity-40 transition-colors"
              style={{ background: TIPO_CONFIG[tipo].color }}>
              {isSaving ? 'Guardando...' : '+ Agregar proyecto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de parámetros ───────────────────────────────────────────────────────

function ParametrosModal({
  estados, config, onClose,
}: {
  estados: EstadoML[]; config: ConfigML | null; onClose: () => void
}) {
  const [tab, setTab] = useState<'estados' | 'config'>('config')
  const [configForm, setConfigForm] = useState({
    tipo_cambio: String(config?.tipo_cambio ?? '1450'),
    usd_por_lote: String(config?.usd_por_lote ?? '10000'),
    lotes_por_ha: String(config?.lotes_por_ha ?? '25'),
  })
  const [configError, setConfigError] = useState<string | null>(null)
  const qc = useQueryClient()

  const updateConfig = useMutation({
    mutationFn: (data: { tipo_cambio?: number; usd_por_lote?: number; lotes_por_ha?: number }) =>
      miLugarApi.updateConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-config'] })
      setConfigError(null)
    },
    onError: (err) => setConfigError(extractErrorMessage(err, 'Error al guardar configuración.')),
  })

  const deleteEstado = useMutation({
    mutationFn: (id: number) => miLugarApi.deleteEstado(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ml-estados'] }),
    onError: (err) => alert(extractErrorMessage(err, 'No se puede eliminar el estado.')),
  })

  const inp = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'
  const lbl = 'block text-xs font-bold text-gray-500 uppercase mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-lg w-[640px] max-w-[97vw] max-h-[88vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10" style={{ background: 'var(--color-gov-navy)' }}>
          <h3 className="flex-1 font-semibold text-sm">⚙ Parámetros — Mi Lugar</h3>
          <button type="button" onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="flex border-b border-slate-100">
          {(['config', 'estados'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${tab === t ? 'text-gov-navy border-b-2 border-gov-navy bg-sky-50' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'config' ? 'Parámetros financieros' : 'Catálogo de estados'}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'config' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'tipo_cambio', label: 'Tipo de cambio ($/US$)' },
                  { key: 'usd_por_lote', label: 'US$ por lote' },
                  { key: 'lotes_por_ha', label: 'Lotes por hectárea' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className={lbl}>{label}</label>
                    <input type="number" className={inp}
                      value={configForm[key as keyof typeof configForm]}
                      onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {configError && <p className="text-xs text-red-600">{configError}</p>}
              <div className="flex justify-end">
                <button type="button"
                  disabled={updateConfig.isPending}
                  onClick={() => updateConfig.mutate({
                    tipo_cambio: parseFloat(configForm.tipo_cambio),
                    usd_por_lote: parseFloat(configForm.usd_por_lote),
                    lotes_por_ha: parseFloat(configForm.lotes_por_ha),
                  })}
                  className="text-xs px-4 py-2 rounded bg-gov-navy text-white font-semibold hover:bg-gov-blue disabled:opacity-40">
                  {updateConfig.isPending ? 'Guardando...' : updateConfig.isSuccess ? '✓ Guardado' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
          {tab === 'estados' && (
            <div className="space-y-2">
              {estados.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs border border-slate-100 rounded px-3 py-2">
                  <span className="w-5 text-gray-400">{e.orden}</span>
                  <span className="flex-1 font-medium">{e.label}</span>
                  <span className="px-2 py-0.5 rounded text-[10px]" style={{ background: e.bg, color: e.text_color }}>{e.label}</span>
                  <button type="button" className="text-gray-300 hover:text-red-500 transition-colors"
                    onClick={() => { if (confirm(`¿Eliminar el estado "${e.label}"?`)) deleteEstado.mutate(e.id) }}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tabla por tipo ────────────────────────────────────────────────────────────

function TablaProyectos({
  tipo, proyectos, estados, onOpenSide, onEdit, onDelete, canWrite, canTransicion,
}: {
  tipo: TipoProyectoML
  proyectos: ProyectoML[]
  estados: EstadoML[]
  onOpenSide: (p: ProyectoML) => void
  onEdit: (p: ProyectoML) => void
  onDelete: (p: ProyectoML) => void
  canWrite: boolean
  canTransicion: boolean
}) {
  const [filterNombre, setFilterNombre] = useState('')
  const [filterLocalidad, setFilterLocalidad] = useState('')
  const [filterEstado, setFilterEstado] = useState<number | ''>('')
  const [sortCol, setSortCol] = useState<string>('nombre')
  const [sortAsc, setSortAsc] = useState(true)

  const localidades = useMemo(() =>
    [...new Set(proyectos.map((p) => p.localidad_nombre).filter(Boolean))].sort(),
    [proyectos]
  )

  const filtered = useMemo(() => {
    let items = proyectos
    if (filterNombre.trim()) {
      const q = filterNombre.toLowerCase()
      items = items.filter((p) => p.nombre.toLowerCase().includes(q) || (p.obs ?? '').toLowerCase().includes(q))
    }
    if (filterLocalidad) {
      items = items.filter((p) => p.localidad_nombre === filterLocalidad)
    }
    if (filterEstado !== '') {
      items = items.filter((p) =>
        p.ejuridico === filterEstado || p.etecnico === filterEstado || p.efinanciero === filterEstado
      )
    }
    const dir = sortAsc ? 1 : -1
    return [...items].sort((a, b) => {
      if (sortCol === 'nombre') return dir * a.nombre.localeCompare(b.nombre)
      if (sortCol === 'localidad') return dir * a.localidad_nombre.localeCompare(b.localidad_nombre)
      if (sortCol === 'lotes') return dir * ((a.lotes ?? 0) - (b.lotes ?? 0))
      if (sortCol === 'monto') return dir * ((a.monto ?? 0) - (b.monto ?? 0))
      if (sortCol === 'avance') return dir * (avancePct(a, estados) - avancePct(b, estados))
      return 0
    })
  }, [proyectos, filterNombre, filterLocalidad, filterEstado, sortCol, sortAsc, estados])

  function sortBy(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const thBase = 'text-left text-[11px] font-semibold uppercase tracking-wide text-gov-cyan px-2 py-2 whitespace-nowrap cursor-pointer select-none hover:text-white'
  const tdBase = 'px-2 py-2 text-xs text-gray-700 align-middle whitespace-nowrap'
  const cfg = TIPO_CONFIG[tipo]
  const tieneFinanciero = tipo === 'exp' || tipo === 'prov'

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan w-52"
          placeholder="Buscar por nombre u obs..."
          value={filterNombre}
          onChange={(e) => setFilterNombre(e.target.value)}
        />
        <select
          className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none"
          value={filterLocalidad}
          onChange={(e) => setFilterLocalidad(e.target.value)}
        >
          <option value="">📍 Todas las localidades</option>
          {localidades.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select
          className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none"
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value ? parseInt(e.target.value) : '')}
        >
          <option value="">🏷 Todos los estados</option>
          {estados.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        {(filterNombre || filterLocalidad || filterEstado !== '') && (
          <button type="button" className="text-xs text-gray-500 hover:text-gray-700"
            onClick={() => { setFilterNombre(''); setFilterLocalidad(''); setFilterEstado('') }}>
            ✕ Limpiar
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} proyectos</span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-left" style={{ minWidth: 900 }}>
          <thead>
            <tr style={{ background: cfg.color }}>
              <th style={S1_HEAD} className={thBase}>#</th>
              <th style={S2_HEAD} className={thBase} onClick={() => sortBy('nombre')}>
                Nombre {sortCol === 'nombre' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th className={thBase} onClick={() => sortBy('localidad')}>Localidad {sortCol === 'localidad' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th className={thBase}>Expediente</th>
              <th className={thBase}>Geo</th>
              <th className={thBase}>Superficie</th>
              <th className={thBase} onClick={() => sortBy('lotes')}>Lotes {sortCol === 'lotes' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th className={thBase}>E.Jurídico</th>
              <th className={thBase}>E.Técnico</th>
              <th className={thBase}>E.Presup.</th>
              <th className={thBase} onClick={() => sortBy('monto')}>Monto {sortCol === 'monto' ? (sortAsc ? '↑' : '↓') : ''}</th>
              {tieneFinanciero && <>
                {tipo === 'exp' && <th className={thBase} style={{ background: 'rgba(0,0,0,0.2)' }}>Valor Fiscal</th>}
                <th className={thBase} style={{ background: 'rgba(0,0,0,0.2)' }}>INFRA s/Nexos</th>
                <th className={thBase} style={{ background: 'rgba(0,0,0,0.2)' }}>NEXOS</th>
                <th className={thBase} style={{ background: 'rgba(0,0,0,0.2)' }}>UNC</th>
                <th className={thBase} style={{ background: 'rgba(0,0,0,0.2)' }}>Costo Total</th>
              </>}
              <th className={thBase} onClick={() => sortBy('avance')}>Avance {sortCol === 'avance' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th className={thBase}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => {
              const pct = avancePct(p, estados)
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-sky-50/40 transition-colors">
                  <td style={S1_BODY} className={tdBase + ' text-gray-400'}>{idx + 1}</td>
                  <td style={S2_BODY} className={tdBase}>
                    <button type="button"
                      onClick={() => onOpenSide(p)}
                      className="font-semibold text-gov-navy hover:underline hover:text-gov-blue text-left text-xs max-w-[170px] truncate block">
                      {p.nombre}
                    </button>
                    {p.obs && <span className="block text-[10px] text-gray-400 truncate max-w-[170px]">{p.obs}</span>}
                  </td>
                  <td className={tdBase}>{p.localidad_nombre}</td>
                  <td className={tdBase + ' text-[11px] text-gray-500'}>{p.expediente || '—'}</td>
                  <td className={tdBase}><GeoLinks puntos={p.geo_puntos} /></td>
                  <td className={tdBase}>{p.superficie != null ? `${p.superficie} Ha` : '—'}</td>
                  <td className={tdBase + ' text-right font-semibold'}>{p.lotes?.toLocaleString('es-AR') ?? '—'}</td>
                  <td className={tdBase}><EstadoBadge id={p.ejuridico} estados={estados} /></td>
                  <td className={tdBase}><EstadoBadge id={p.etecnico} estados={estados} /></td>
                  <td className={tdBase}><EstadoBadge id={p.efinanciero} estados={estados} /></td>
                  <td className={tdBase + ' text-right font-semibold text-gov-navy'}>{fmtMonto(p.monto)}</td>
                  {tieneFinanciero && <>
                    {tipo === 'exp' && <td className={tdBase + ' text-right font-semibold'}>{fmtMonto(p.valor_fiscal)}</td>}
                    <td className={tdBase + ' text-right font-semibold'}>{fmtMonto(p.infra_sin_nexos)}</td>
                    <td className={tdBase + ' text-right font-semibold'}>{fmtMonto(p.costo_nexos)}</td>
                    <td className={tdBase + ' text-right font-semibold'}>{fmtMonto(p.convenio_unc)}</td>
                    <td className={tdBase + ' text-right font-semibold'}>{fmtMonto(p.costo_total_infra)}</td>
                  </>}
                  <td className={tdBase}>
                    <div className="flex items-center gap-1.5 min-w-[80px]">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: avanceColor(pct) }} />
                      </div>
                      <span className="text-[10px] text-gray-500 w-7 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className={tdBase}>
                    <div className="flex gap-1">
                      <button type="button" title="Historial" onClick={() => onOpenSide(p)} className="text-base hover:scale-110 transition-transform">📋</button>
                      {canWrite && (
                        <button type="button" title="Editar" onClick={() => onEdit(p)} className="text-base hover:scale-110 transition-transform">✏️</button>
                      )}
                      {canTransicion && (
                        <button type="button" title="Eliminar" onClick={() => onDelete(p)} className="text-base hover:scale-110 transition-transform">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={tieneFinanciero ? (tipo === 'exp' ? 18 : 17) : 14} className="text-center text-xs text-gray-400 py-8">
                  Sin proyectos. {canWrite && 'Usá "+ Agregar Proyecto" para añadir.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function MiLugarPage() {
  const [tab, setTab] = useState<TipoProyectoML>('exp')
  const [sidePanel, setSidePanel] = useState<ProyectoML | null>(null)
  const [editModal, setEditModal] = useState<ProyectoML | null>(null)
  const [createTipo, setCreateTipo] = useState<TipoProyectoML | null>(null)
  const [showParams, setShowParams] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const qc = useQueryClient()
  const { data: user } = usePortalUser()
  const canWrite = user?.rol === 'Admin' || user?.rol === 'Supervisor' || user?.rol === 'Operador'
  const canTransicion = user?.rol === 'Admin' || user?.rol === 'Supervisor'

  const proyectosQuery = useQuery({
    queryKey: ['ml-proyectos', tab],
    queryFn: () => miLugarApi.getProyectos({ tipo: tab }),
  })
  const estadosQuery = useQuery({
    queryKey: ['ml-estados'],
    queryFn: () => miLugarApi.getEstados(),
  })
  const configQuery = useQuery({
    queryKey: ['ml-config'],
    queryFn: () => miLugarApi.getConfig(),
  })

  const proyectos = proyectosQuery.data ?? []
  const estados = estadosQuery.data ?? []
  const config = configQuery.data ?? null

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProyectoMLUpdate }) =>
      miLugarApi.updateProyecto(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-proyectos'] })
      setEditModal(null)
      setEditError(null)
    },
    onError: (err) => setEditError(extractErrorMessage(err, 'Error al guardar.')),
  })

  const createMutation = useMutation({
    mutationFn: (data: ProyectoMLCreate) => miLugarApi.createProyecto(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-proyectos'] })
      setCreateTipo(null)
      setCreateError(null)
    },
    onError: (err) => setCreateError(extractErrorMessage(err, 'Error al crear proyecto.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => miLugarApi.deleteProyecto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ml-proyectos'] }),
  })

  function handleDelete(p: ProyectoML) {
    if (confirm(`¿Eliminar el proyecto "${p.nombre}"? Esta acción no puede deshacerse.`)) {
      deleteMutation.mutate(p.id)
    }
  }

  const tabs: TipoProyectoML[] = ['exp', 'muni', 'prov']

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gov-navy">Mi Lugar — Adquisición de Tierras</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de predios para proyectos habitacionales.</p>
        </div>
        {canTransicion && (
          <button type="button" onClick={() => setShowParams(true)}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-gray-600 border border-slate-200 px-3 py-2 rounded transition-colors font-medium">
            ⚙ Parámetros
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {tabs.map((t) => {
          const cfg = TIPO_CONFIG[t]
          const isActive = tab === t
          return (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${isActive ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              style={isActive ? { color: cfg.color, borderColor: cfg.color } : undefined}>
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div />
        {canWrite && (
          <button type="button"
            onClick={() => setCreateTipo(tab)}
            className="text-xs font-semibold px-4 py-2 rounded text-white hover:opacity-80 transition-opacity"
            style={{ background: TIPO_CONFIG[tab].color }}>
            + Agregar Proyecto
          </button>
        )}
      </div>

      {/* Contenido */}
      {proyectosQuery.isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando proyectos...</p>
      ) : proyectosQuery.isError ? (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-600">Error al cargar proyectos.</div>
      ) : (
        <TablaProyectos
          tipo={tab}
          proyectos={proyectos}
          estados={estados}
          onOpenSide={(p) => setSidePanel(p)}
          onEdit={(p) => { setEditModal(p); setEditError(null) }}
          onDelete={handleDelete}
          canWrite={canWrite}
          canTransicion={canTransicion}
        />
      )}

      {/* Panel lateral */}
      {sidePanel && (
        <SidePanel
          proyecto={sidePanel}
          estados={estados}
          onClose={() => setSidePanel(null)}
          canWrite={canWrite}
        />
      )}

      {/* Modal edición */}
      {editModal && (
        <EditModal
          proyecto={editModal}
          estados={estados}
          config={config}
          onSave={(data) => updateMutation.mutate({ id: editModal.id, data })}
          onClose={() => setEditModal(null)}
          isSaving={updateMutation.isPending}
          saveError={editError}
        />
      )}

      {/* Modal alta */}
      {createTipo && (
        <CreateModal
          tipo={createTipo}
          config={config}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setCreateTipo(null)}
          isSaving={createMutation.isPending}
          saveError={createError}
        />
      )}

      {/* Modal parámetros */}
      {showParams && (
        <ParametrosModal
          estados={estados}
          config={config}
          onClose={() => setShowParams(false)}
        />
      )}
    </div>
  )
}
