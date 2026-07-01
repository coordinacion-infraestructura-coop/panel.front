import { useState, useMemo, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cordonCunetaApi } from '../api/vivienda.api'
import type { EstadoCC, MunicipioCC, MunicipioCCUpdate, PedidoCC } from '../types/vivienda.types'

// ── helpers ─────────────────────────────────────────────────────────────────────

function fmtMonto(n: number | null) {
  if (!n) return '—'
  return '$' + Number(n).toLocaleString('es-AR')
}
function fmtMl(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-AR')
}
function fmtMontoResumen(n: number) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  return '$' + (n / 1e6).toFixed(1) + 'M'
}
function avancePct(p: MunicipioCC, estados: EstadoCC[]) {
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
  if (pct < 80) return '#398ebd'
  return '#22c55e'
}

// ── Badge de estado ──────────────────────────────────────────────────────────────
function EstadoBadge({ id, estados }: { id: number | null; estados: EstadoCC[] }) {
  const e = estados.find((s) => s.id === id)
  if (!e) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: e.bg, color: e.text_color }}
    >
      {e.label}
    </span>
  )
}

// ── OK Gobernación badge ─────────────────────────────────────────────────────────
function OkBadge({ v }: { v: string }) {
  const cls =
    v === 'SI' ? 'bg-green-100 text-green-800' :
    v === 'NO' ? 'bg-red-100 text-red-800' :
    'bg-yellow-100 text-yellow-800'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{v}</span>
  )
}

// ── Modal de edición ─────────────────────────────────────────────────────────────
const DEPTOS = ['Calamuchita','Cruz del Eje','General Roca','Juarez Cleman','Marcos Juárez','Pdte R. Sáenz Peña','Rio Segundo','San Javier','San Justo','Santa María','Tercero Arriba']

function EditModal({
  municipio,
  estados,
  onSave,
  onClose,
  isSaving,
}: {
  municipio: MunicipioCC
  estados: EstadoCC[]
  onSave: (data: MunicipioCCUpdate) => void
  onClose: () => void
  isSaving: boolean
}) {
  const uid = useId()
  const [form, setForm] = useState<MunicipioCCUpdate>({
    municipio: municipio.municipio,
    departamento: municipio.departamento ?? '',
    expediente: municipio.expediente ?? '',
    monto: municipio.monto ?? undefined,
    ok_gob: municipio.ok_gob,
    doc_exp: municipio.doc_exp ?? '',
    ejuridico: municipio.ejuridico,
    etecnico: municipio.etecnico,
    efinanciero: municipio.efinanciero,
    cordon_cuneta_ml: municipio.cordon_cuneta_ml ?? undefined,
    adoquinado_m2: municipio.adoquinado_m2 ?? undefined,
    obs: municipio.obs ?? '',
  })

  const set = (k: keyof MunicipioCCUpdate, v: string | number | null | undefined) =>
    setForm((p) => ({ ...p, [k]: v }))

  const labelCls = 'block text-xs font-bold text-gray-500 uppercase mb-1'
  const inputCls = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
    >
      <div className="bg-white rounded-lg w-[740px] max-w-[97vw] max-h-[92vh] overflow-y-auto shadow-xl">
        <div
          className="text-white px-4 py-3 flex items-center gap-3 rounded-t-lg sticky top-0 z-10"
          style={{ background: '#172c3f' }}
        >
          <h3 id={`${uid}-title`} className="flex-1 font-semibold text-sm">
            Editar — {municipio.municipio}
          </h3>
          <button
            onClick={onClose}
            className="text-sky-300 hover:text-white text-xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor={`${uid}-municipio`} className={labelCls}>Municipio *</label>
              <input id={`${uid}-municipio`} className={inputCls} value={form.municipio ?? ''} onChange={(e) => set('municipio', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${uid}-depto`} className={labelCls}>Departamento</label>
              <select id={`${uid}-depto`} className={inputCls} value={form.departamento ?? ''} onChange={(e) => set('departamento', e.target.value)}>
                <option value="">—</option>
                {DEPTOS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-expediente`} className={labelCls}>Expediente N°</label>
              <input id={`${uid}-expediente`} className={`${inputCls} font-mono`} value={form.expediente ?? ''} onChange={(e) => set('expediente', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${uid}-monto`} className={labelCls}>Monto ($)</label>
              <input id={`${uid}-monto`} type="number" className={inputCls} value={form.monto ?? ''} onChange={(e) => set('monto', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-ok-gob`} className={labelCls}>OK Gobernación</label>
              <select id={`${uid}-ok-gob`} className={inputCls} value={form.ok_gob ?? 'SI'} onChange={(e) => set('ok_gob', e.target.value)}>
                <option>SI</option>
                <option>NO</option>
                <option>En trámite</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-cc-ml`} className={labelCls}>Cordón-Cuneta (ml)</label>
              <input id={`${uid}-cc-ml`} type="number" className={inputCls} value={form.cordon_cuneta_ml ?? ''} onChange={(e) => set('cordon_cuneta_ml', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label htmlFor={`${uid}-ado-m2`} className={labelCls}>Adoquinado (m²)</label>
              <input id={`${uid}-ado-m2`} type="number" className={inputCls} value={form.adoquinado_m2 ?? ''} onChange={(e) => set('adoquinado_m2', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-doc-exp`} className={labelCls}>Exp. Documentación</label>
              <input id={`${uid}-doc-exp`} className={inputCls} value={form.doc_exp ?? ''} onChange={(e) => set('doc_exp', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-obs`} className={labelCls}>Observaciones</label>
              <textarea id={`${uid}-obs`} rows={2} className={inputCls} value={form.obs ?? ''} onChange={(e) => set('obs', e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gov-navy">
              Estados por Dimensión
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                ['ejuridico',   'Jurídico / Administrativo'],
                ['etecnico',    'Técnico'],
                ['efinanciero', 'Presup. / Financiero'],
              ] as const).map(([field, label]) => (
                <div key={field} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <label
                    htmlFor={`${uid}-${field}`}
                    className="block text-xs font-bold uppercase mb-2 text-gov-navy"
                  >
                    {label}
                  </label>
                  <select
                    id={`${uid}-${field}`}
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                    value={form[field] ?? ''}
                    onChange={(e) => set(field, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">—</option>
                    {estados.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={isSaving}
            className="px-5 py-1.5 rounded text-sm text-white disabled:opacity-50 transition-colors hover:opacity-90"
            style={{ background: '#172c3f' }}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel de detalle (drawer derecho) ───────────────────────────────────────────
function DetailPanel({
  municipio,
  onClose,
}: {
  municipio: MunicipioCC
  onClose: () => void
}) {
  const uid = useId()
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState('')
  const [fecha, setFecha] = useState(today)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['cc-pedidos', municipio.id],
    queryFn: () => cordonCunetaApi.getPedidos(municipio.id),
  })

  const mutation = useMutation({
    mutationFn: (d: { descripcion: string; fecha_pedido: string }) =>
      cordonCunetaApi.createPedido(municipio.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-pedidos', municipio.id] })
      setDesc('')
      setFecha(today)
      setShowForm(false)
      setSaveError(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string; message?: string } } })
        ?.response?.data?.detail
        ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Error al guardar. Verificá la consola.'
      setSaveError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (pedidoId: string) =>
      cordonCunetaApi.deletePedido(municipio.id, pedidoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-pedidos', municipio.id] })
      setConfirmDelete(null)
    },
  })

  const handleSave = () => {
    if (!desc.trim()) return
    mutation.mutate({ descripcion: desc.trim(), fecha_pedido: fecha })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between border-b border-slate-200" style={{ background: '#172c3f' }}>
          <div>
            <div className="text-[10px] font-semibold tracking-widest mb-0.5 text-gov-cyan uppercase">
              Historial de comunicaciones
            </div>
            <h3 id={`${uid}-title`} className="text-white font-semibold text-sm">{municipio.municipio}</h3>
            {municipio.departamento && (
              <p className="text-xs mt-0.5 text-white/60">{municipio.departamento}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-sky-300 hover:text-white text-xl leading-none ml-4 mt-0.5 transition-colors"
            aria-label="Cerrar historial"
          >
            ✕
          </button>
        </div>

        {/* Botón nueva actualización */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full text-sm font-medium py-2 rounded border-2 border-dashed border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors"
            >
              + Nueva actualización
            </button>
          ) : (
            <div className="space-y-2">
              <label htmlFor={`${uid}-desc`} className="block text-xs font-bold uppercase text-gray-500">
                ¿Qué se solicitó / comunicó?
              </label>
              <textarea
                id={`${uid}-desc`}
                rows={3}
                autoFocus
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describí el pedido o comunicación realizada..."
                className="w-full border border-sky-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gov-cyan"
              />
              <div className="flex items-center gap-2">
                <label htmlFor={`${uid}-fecha`} className="text-xs font-bold uppercase text-gray-500 flex-shrink-0">
                  Fecha:
                </label>
                <input
                  id={`${uid}-fecha`}
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="border border-sky-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                />
              </div>
              {saveError && (
                <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {saveError}
                </p>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => { setShowForm(false); setDesc(''); setFecha(today); setSaveError(null) }}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={mutation.isPending || !desc.trim()}
                  className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 transition-colors hover:opacity-90"
                  style={{ background: '#172c3f' }}
                >
                  {mutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de pedidos */}
        <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          {isLoading && (
            <p role="status" className="text-sm text-gray-400 text-center py-8">Cargando...</p>
          )}
          {!isLoading && pedidos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              Sin comunicaciones registradas aún.
            </p>
          )}
          <ol className="space-y-3" aria-label="Historial de comunicaciones">
            {pedidos.map((p: PedidoCC, i: number) => (
              <li key={p.id} className="flex gap-3 group">
                <div className="flex flex-col items-center" aria-hidden="true">
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                    style={{ background: i === 0 ? '#01aae3' : '#bae6fd' }}
                  />
                  {i < pedidos.length - 1 && (
                    <div className="w-px flex-1 mt-1 bg-slate-200" />
                  )}
                </div>
                <div className="pb-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <time
                      className="text-xs font-semibold text-gov-navy"
                      dateTime={p.fecha_pedido}
                    >
                      {new Date(p.fecha_pedido + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </time>
                    {p.created_by && (
                      <span className="text-xs text-gray-400">· {p.created_by.split('@')[0]}</span>
                    )}
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
                      aria-label="Eliminar esta actualización"
                      title="Eliminar"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 leading-snug">{p.descripcion}</p>
                  {confirmDelete === p.id && (
                    <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2">
                      <span className="text-xs text-red-700 flex-1">¿Eliminar esta actualización?</span>
                      <button
                        onClick={() => deleteMutation.mutate(p.id)}
                        disabled={deleteMutation.isPending}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 transition-colors"
                      >
                        {deleteMutation.isPending ? '...' : 'Sí, eliminar'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────────
export function CordonCunetaPage() {
  const queryClient = useQueryClient()
  const searchId = useId()
  const deptoId = useId()
  const okId = useId()

  const [search, setSearch] = useState('')
  const [deptoFilter, setDeptoFilter] = useState('')
  const [okFilter, setOkFilter] = useState('')
  const [editTarget, setEditTarget] = useState<MunicipioCC | null>(null)
  const [detailTarget, setDetailTarget] = useState<MunicipioCC | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cordon-cuneta'],
    queryFn: cordonCunetaApi.getPanel,
  })

  const mutation = useMutation({
    mutationFn: ({ id, upd }: { id: string; upd: MunicipioCCUpdate }) =>
      cordonCunetaApi.updateMunicipio(id, upd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cordon-cuneta'] })
      setEditTarget(null)
    },
  })

  const municipios = data?.municipios ?? []
  const estados = data?.estados ?? []
  const presupuesto = data?.presupuesto ?? 0

  const deptos = useMemo(
    () => [...new Set(municipios.map((m) => m.departamento).filter(Boolean))].sort() as string[],
    [municipios]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return municipios.filter((m) => {
      if (q && !`${m.municipio} ${m.expediente ?? ''} ${m.obs ?? ''} ${m.doc_exp ?? ''}`.toLowerCase().includes(q)) return false
      if (deptoFilter && m.departamento !== deptoFilter) return false
      if (okFilter && m.ok_gob !== okFilter) return false
      return true
    })
  }, [municipios, search, deptoFilter, okFilter])

  const montoTotal = municipios.reduce((s, m) => s + (m.monto ?? 0), 0)
  const saldo = montoTotal - presupuesto
  const conOkGob = municipios.filter((m) => m.ok_gob === 'SI').length
  const sinDoc = municipios.filter((m) => !m.doc_exp).length
  const ccMlTotal = municipios.reduce((s, m) => s + (m.cordon_cuneta_ml ?? 0), 0)
  const adM2Total = municipios.reduce((s, m) => s + (m.adoquinado_m2 ?? 0), 0)

  if (isLoading) {
    return (
      <p role="status" aria-live="polite" className="text-center py-12 text-gray-500">
        Cargando...
      </p>
    )
  }
  if (error) {
    return (
      <p role="alert" className="text-red-600 py-4">
        Error al cargar el panel.
      </p>
    )
  }

  return (
    <div>
      {/* Título de página */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gov-cyan mb-1">
          Programa Provincial — Secretaría de Vivienda
        </p>
        <h2 className="text-xl font-bold text-gov-navy">Cordón Cuneta y Adoquinado</h2>
      </div>

      {/* KPI cards */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: 'Municipios',          value: String(municipios.length), color: '#172c3f' },
          { label: 'Monto Total',         value: fmtMontoResumen(montoTotal), color: '#398ebd' },
          { label: 'OK Min. de Gobierno', value: String(conOkGob), color: '#22c55e' },
          { label: 'Sin Documentación',   value: String(sinDoc), color: '#ef4444' },
          { label: 'Cordón-Cuneta (ml)',  value: fmtMl(ccMlTotal), color: '#172c3f' },
          { label: 'Adoquinado (m²)',     value: fmtMl(adM2Total), color: '#172c3f' },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-md px-4 py-3 min-w-[140px] shadow-sm border border-slate-100"
            style={{ borderTop: `4px solid ${c.color}` }}
          >
            <div className="text-2xl font-bold leading-none" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{c.label}</div>
          </div>
        ))}
        {presupuesto > 0 && (
          <div
            className="bg-white rounded-md px-4 py-3 min-w-[160px] shadow-sm border border-slate-100"
            style={{ borderTop: '4px solid #01aae3' }}
          >
            <div className="text-lg font-bold leading-none text-gov-cyan">{fmtMontoResumen(presupuesto)}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Crédito Asignado</div>
            <div className="text-xs font-bold mt-0.5" style={{ color: saldo >= 0 ? '#22c55e' : '#ef4444' }}>
              Saldo: {fmtMontoResumen(Math.abs(saldo))}{saldo < 0 ? ' (déficit)' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-t-md px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor={searchId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">
            Buscar
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Municipio, expediente, observaciones..."
            className="border border-slate-200 rounded px-2 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gov-cyan"
            aria-label="Buscar municipio, expediente u observaciones"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={deptoId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">
            Departamento
          </label>
          <select
            id={deptoId}
            value={deptoFilter}
            onChange={(e) => setDeptoFilter(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
          >
            <option value="">— Todos —</option>
            {deptos.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={okId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">
            OK Gobernación
          </label>
          <select
            id={okId}
            value={okFilter}
            onChange={(e) => setOkFilter(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
          >
            <option value="">— Todos —</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        </div>
        {(search || deptoFilter || okFilter) && (
          <button
            onClick={() => { setSearch(''); setDeptoFilter(''); setOkFilter('') }}
            className="border border-slate-200 rounded px-3 py-1 text-xs font-bold text-gray-600 hover:bg-slate-50 transition-colors"
          >
            ✕ Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'proyecto' : 'proyectos'}
        </span>
      </div>

      {/* Panel de tabla */}
      <div className="bg-white rounded-b-md shadow-sm border border-t-0 border-slate-200 overflow-hidden mb-6">
        {/* Subtítulo */}
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <span className="text-xs font-bold text-gov-navy">
            Convenios con Municipios — Provincia de Córdoba
          </span>
        </div>

        {/* Leyenda de estados */}
        <div className="flex flex-wrap gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold text-gov-navy mr-1">Estados:</span>
          {estados.map((e) => (
            <span key={e.id} className="flex items-center gap-1 text-xs text-gray-600">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: e.bg, border: `1px solid ${e.text_color}` }}
                aria-hidden="true"
              />
              {e.label}
            </span>
          ))}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto" role="region" aria-label="Tabla de municipios">
          <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#172c3f', color: '#fff' }}>
                {[
                  ['#', null],
                  ['Municipio', null],
                  ['Departamento', null],
                  ['Expediente N°', null],
                  ['Monto', null],
                  ['Cordón-Cuneta (ml)', null],
                  ['Adoquinado (m²)', null],
                  ['OK Gob.', null],
                  ['Exp. Documentación', null],
                  ['Est. Jurídico-Adm.', null],
                  ['Est. Técnico', null],
                  ['Est. Presup./Fin.', null],
                  ['Avance', null],
                  ['Acciones', null],
                ].map(([h]) => (
                  <th
                    key={h as string}
                    scope="col"
                    className="px-2.5 py-2 text-left font-semibold whitespace-nowrap"
                    style={{ fontSize: '11px' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-10 text-gray-400">
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              )}
              {filtered.map((m) => {
                const pct = avancePct(m, estados)
                const col = avanceColor(pct)
                return (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 hover:bg-sky-50/40 transition-colors"
                  >
                    <td className="px-2.5 py-1.5 text-gray-400" style={{ fontSize: '11px' }}>{m.orden}</td>
                    <td className="px-2.5 py-1.5 font-bold" style={{ fontSize: '12px' }}>
                      {m.municipio}
                      {m.obs ? <div className="text-xs text-gray-400 font-normal">{m.obs}</div> : null}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {m.departamento && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: '#E8EAF6', color: '#283593' }}>
                          {m.departamento}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-gray-600" style={{ fontSize: '11px' }}>{m.expediente || '—'}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gov-blue whitespace-nowrap" style={{ fontSize: '11px' }}>{fmtMonto(m.monto)}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-right">{fmtMl(m.cordon_cuneta_ml)}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-right">{fmtMl(m.adoquinado_m2)}</td>
                    <td className="px-2.5 py-1.5"><OkBadge v={m.ok_gob} /></td>
                    <td className="px-2.5 py-1.5" style={{ fontSize: '10px' }}>
                      {m.doc_exp
                        ? <span className="rounded px-1.5 py-0.5" style={{ background: '#E3F2FD', color: '#1565C0', fontSize: '10px' }}>
                            <span aria-hidden="true">📄 </span>{m.doc_exp}
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={m.ejuridico} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={m.etecnico} estados={estados} /></td>
                    <td className="px-2.5 py-1.5"><EstadoBadge id={m.efinanciero} estados={estados} /></td>
                    <td className="px-2.5 py-1.5 min-w-[90px]">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Avance ${pct}%`}
                        >
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                        </div>
                        <span className="text-gray-500 w-7 text-right" style={{ fontSize: '11px' }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setDetailTarget(m)}
                        className="p-1 rounded text-gray-500 hover:text-gov-cyan hover:bg-sky-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
                        aria-label={`Ver historial de ${m.municipio}`}
                        title="Ver historial"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditTarget(m)}
                        className="p-1 rounded text-gray-500 hover:text-gov-navy hover:bg-sky-50 transition-colors ml-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
                        aria-label={`Editar ${m.municipio}`}
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
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
          municipio={editTarget}
          estados={estados}
          isSaving={mutation.isPending}
          onClose={() => setEditTarget(null)}
          onSave={(upd) => mutation.mutate({ id: editTarget.id, upd })}
        />
      )}

      {detailTarget && (
        <DetailPanel
          municipio={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  )
}
