import { useMemo, useState, useId } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checklistTecnicoApi } from '../api/vivienda.api'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import type {
  ChecklistItemDetalle,
  ChecklistTecnico,
  ItemDefinicion,
  ProgramaChecklist,
  TipoHitoChecklist,
  ValorItemChecklist,
} from '../types/vivienda.types'

// ── Helpers ──────────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
function fmtMonto(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}
function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function extractErrorMessage(err: unknown, fallback: string) {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'No tenés permisos para realizar esta acción.'
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in (detail as Record<string, unknown>)) {
    return String((detail as Record<string, unknown>).message)
  }
  return fallback
}

const STATUS_META: Record<ValorItemChecklist, { label: string; bg: string; fg: string }> = {
  sin_presentar: { label: 'Sin Presentar', bg: '#f1f5f9', fg: '#64748b' },
  eval_tecnica: { label: 'En Evaluación Técnica', bg: '#dbeafe', fg: '#1e40af' },
  a_corregir: { label: 'A corregir por M/C', bg: '#fef3c7', fg: '#92400e' },
  eval_juridica: { label: 'En Evaluación Jurídico', bg: '#e0e7ff', fg: '#4338ca' },
  completo: { label: 'Completo OK', bg: '#dcfce7', fg: '#166534' },
}
const STATUS_ORDER: ValorItemChecklist[] = ['sin_presentar', 'eval_tecnica', 'a_corregir', 'eval_juridica', 'completo']

const PROGRAMA_LABEL: Record<ProgramaChecklist, string> = {
  cc: 'Cordón Cuneta y Adoquinado',
  ch: 'Córdoba Hogar',
  ml: 'Mi Lugar',
}
const HITO_LABEL: Record<TipoHitoChecklist, string> = {
  anticipo: 'Anticipo financiero',
  '40': 'Avance físico 40%',
  '70': 'Avance físico 70%',
  '100': 'Avance físico 100%',
}

interface EntidadRef {
  id: string
  nombre: string
}
interface LocalidadGroup {
  key: string
  nombre: string
  departamento: string | null
  programs: Partial<Record<ProgramaChecklist, EntidadRef>>
}

// ── Página ───────────────────────────────────────────────────────────────────────

export function ChecklistTecnicoPage() {
  const { data: portalUser } = usePortalUser()
  const canEdit = portalUser?.rol !== 'Consulta'
  const qc = useQueryClient()
  const searchId = useId()

  const { data: entidades } = useQuery({
    queryKey: ['checklist-entidades'],
    queryFn: checklistTecnicoApi.getEntidades,
  })

  const grupos = useMemo<LocalidadGroup[]>(() => {
    const map = new Map<string, LocalidadGroup>()
    const upsert = (programa: ProgramaChecklist, id: string, nombre: string, departamento: string | null) => {
      const key = `${normalize(nombre)}|${normalize(departamento ?? '')}`
      let g = map.get(key)
      if (!g) {
        g = { key, nombre, departamento, programs: {} }
        map.set(key, g)
      }
      g.programs[programa] = { id, nombre }
    }
    for (const e of entidades ?? []) upsert(e.programa, e.id, e.nombre, e.departamento)
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [entidades])

  const [search, setSearch] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const [programa, setPrograma] = useState<ProgramaChecklist>('cc')
  const [saved, setSaved] = useState(false)

  const selectedGroup = grupos.find((g) => g.key === selectedKey) ?? null
  const entidad = selectedGroup?.programs[programa] ?? null

  const filtered = useMemo(() => {
    const q = normalize(search)
    if (!q) return grupos.slice(0, 30)
    return grupos.filter((g) => normalize(g.nombre).includes(q) || normalize(g.departamento ?? '').includes(q)).slice(0, 30)
  }, [grupos, search])

  function flashSaved() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  function selectLocalidad(key: string) {
    const g = grupos.find((x) => x.key === key)
    if (!g) return
    setSelectedKey(key)
    setSearch('')
    setComboOpen(false)
    setRecent((r) => [key, ...r.filter((k) => k !== key)].slice(0, 5))
    if (!g.programs[programa]) {
      const first = (['cc', 'ch', 'ml'] as ProgramaChecklist[]).find((p) => g.programs[p])
      if (first) setPrograma(first)
    }
  }

  const checklistKey = ['checklist-tecnico', programa, entidad?.id] as const
  const { data: checklist, isLoading: checklistLoading } = useQuery({
    queryKey: checklistKey,
    queryFn: () => checklistTecnicoApi.getChecklist(programa, entidad!.id),
    enabled: !!entidad,
  })

  const { data: catalogos } = useQuery({ queryKey: ['checklist-catalogos'], queryFn: checklistTecnicoApi.getCatalogos })

  const onMutationSuccess = (data: ChecklistTecnico) => {
    qc.setQueryData(checklistKey, data)
    flashSaved()
  }

  const [mutationError, setMutationError] = useState<string | null>(null)
  const onMutationError = (err: unknown) => setMutationError(extractErrorMessage(err, 'No se pudo guardar el cambio.'))

  const updateChecklistMut = useMutation({
    mutationFn: (data: { estado_expediente_id?: number | null; fecha_radicacion?: string | null; reparticion_id?: number | null }) =>
      checklistTecnicoApi.updateChecklist(programa, entidad!.id, data),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })
  const updateItemMut = useMutation({
    mutationFn: (vars: { itemNum: number; subItemNum: number | null; valor: ValorItemChecklist }) =>
      checklistTecnicoApi.updateItem(programa, entidad!.id, vars.itemNum, { valor: vars.valor, sub_item_num: vars.subItemNum }),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })
  const updateHitoMut = useMutation({
    mutationFn: (vars: { tipo: TipoHitoChecklist; fecha: string | null }) =>
      checklistTecnicoApi.updateHito(programa, entidad!.id, vars.tipo, { fecha_acreditado: vars.fecha }),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const itemsDef: ItemDefinicion[] = catalogos?.items_por_programa[programa] ?? []

  return (
    <div className="space-y-4">
      {mutationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-center justify-between">
          {mutationError}
          <button className="text-red-400 hover:text-red-600" onClick={() => setMutationError(null)}>✕</button>
        </div>
      )}

      {/* ── Selector de localidad ────────────────────────────────────────── */}
      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sticky top-3 z-20">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative flex-1 min-w-[16rem]">
            <label htmlFor={searchId} className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
              Buscar localidad
            </label>
            <input
              id={searchId}
              type="text"
              autoComplete="off"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gov-cyan focus:border-gov-cyan"
              placeholder="Escribí una localidad o departamento…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setComboOpen(true) }}
              onFocus={() => setComboOpen(true)}
              onBlur={() => window.setTimeout(() => setComboOpen(false), 150)}
            />
            {comboOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto z-30">
                {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>}
                {filtered.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-sky-50 border-b border-slate-50 last:border-b-0 text-left"
                    onMouseDown={(e) => { e.preventDefault(); selectLocalidad(g.key) }}
                  >
                    <span>
                      <span className="text-gray-900 font-medium">{g.nombre}</span>{' '}
                      <span className="text-gray-400 text-xs">— {g.departamento ?? 'sin depto'}</span>
                    </span>
                    <span className="flex gap-1">
                      {(['cc', 'ch', 'ml'] as ProgramaChecklist[]).map((p) =>
                        g.programs[p] ? (
                          <span key={p} className="text-[9px] font-bold uppercase bg-gov-navy/10 text-gov-navy px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ) : null
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {recent.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[11px] text-gray-400 font-semibold mr-1">Recientes:</span>
                {recent.map((k) => {
                  const g = grupos.find((x) => x.key === k)
                  if (!g) return null
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => selectLocalidad(k)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        k === selectedKey ? 'bg-gov-navy border-gov-navy text-white' : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-sky-50 hover:border-sky-200'
                      }`}
                    >
                      {g.nombre}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <span
              className={`inline-flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-600 px-2.5 py-1 rounded-full transition-opacity ${
                saved ? 'opacity-100' : 'opacity-0'
              }`}
            >
              ✓ Guardado
            </span>
          </div>
        </div>

        {selectedGroup && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gov-navy">{selectedGroup.nombre}</h2>
              <span className="text-sm text-gray-500">{selectedGroup.departamento ?? '—'}</span>
            </div>
          </div>
        )}
      </section>

      {!selectedGroup && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-500">
          Buscá una localidad para empezar a cargar su checklist técnico.
        </div>
      )}

      {selectedGroup && (
        <>
          {/* ── Tabs de programa ──────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {(['cc', 'ch', 'ml'] as ProgramaChecklist[]).map((p) => {
              const has = !!selectedGroup.programs[p]
              const active = programa === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrograma(p)}
                  className={`flex-1 min-w-[9rem] flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-gov-navy border-gov-navy text-white shadow'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-sky-200 hover:text-gov-navy'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${has ? 'bg-gov-cyan' : 'bg-gray-300'}`} />
                  {PROGRAMA_LABEL[p]}
                </button>
              )
            })}
          </div>

          {/* ── Panel ─────────────────────────────────────────────────────── */}
          {!entidad && (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <p className="text-sm font-medium text-gray-600">{selectedGroup.nombre} todavía no tiene convenio cargado en este programa.</p>
              <p className="text-xs text-gray-400 mt-1">Cargalo desde el panel de {PROGRAMA_LABEL[programa]} antes de usar el checklist técnico.</p>
            </div>
          )}

          {entidad && checklistLoading && <div className="text-sm text-gray-400 px-2">Cargando…</div>}

          {entidad && checklist && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 items-start">
              <div className="space-y-4">
                <ProgramaCard
                  checklist={checklist}
                  canEdit={canEdit}
                  estados={catalogos?.estados_expediente ?? []}
                  onUpdateEstado={(estado_expediente_id) => updateChecklistMut.mutate({ estado_expediente_id })}
                />
                <ChecklistCard
                  checklist={checklist}
                  itemsDef={itemsDef}
                  canEdit={canEdit}
                  onChangeItem={(itemNum, subItemNum, valor) => updateItemMut.mutate({ itemNum, subItemNum, valor })}
                />
                {checklist.hitos && (
                  <HitosCard
                    hitos={checklist.hitos}
                    canEdit={canEdit}
                    onChangeFecha={(tipo, fecha) => updateHitoMut.mutate({ tipo, fecha })}
                  />
                )}
              </div>
              <div className="space-y-4">
                <RadicadoCard
                  checklist={checklist}
                  canEdit={canEdit}
                  reparticiones={(catalogos?.reparticiones ?? []).filter((r) => !r.programa || r.programa === programa)}
                  onUpdate={(data) => updateChecklistMut.mutate(data)}
                />
                <ObservacionesCard programa={programa} entidadId={entidad.id} canEdit={canEdit} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function ProgramaCard({
  checklist, canEdit, estados, onUpdateEstado,
}: {
  checklist: ChecklistTecnico
  canEdit: boolean
  estados: { id: number; label: string }[]
  onUpdateEstado: (id: number) => void
}) {
  const currentIdx = estados.findIndex((e) => e.id === checklist.estado_expediente_id)
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gov-navy">{PROGRAMA_LABEL[checklist.programa]}</h3>
        <span className="text-xs text-gray-400">{checklist.entidad.expediente || 'sin expediente radicado'}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
        <StatTile label="Nombre" value={checklist.entidad.nombre} />
        <StatTile label="Expediente" value={checklist.entidad.expediente} mono />
        <StatTile label="Monto convenio" value={fmtMonto(checklist.entidad.monto)} mono />
        <StatTile label={checklist.entidad.dato_extra_label ?? 'Dato adicional'} value={checklist.entidad.dato_extra_valor} />
      </div>
      <p className="px-4 pb-3 text-[11px] text-gray-400 flex items-center gap-1">
        🔒 Datos del convenio — llegan con el expediente, no se editan desde acá.
      </p>

      {estados.length > 0 && (
        <div className="px-4 pb-2 overflow-x-auto">
          <div className="flex items-start min-w-max">
            {estados.map((e, i) => {
              const done = i < currentIdx
              const current = i === currentIdx
              return (
                <div key={e.id} className="flex-1 min-w-[5.5rem] flex flex-col items-center relative">
                  {i > 0 && (
                    <span
                      className={`absolute top-[0.7rem] right-1/2 w-full h-0.5 ${done || current ? 'bg-gov-cyan' : 'bg-gray-200'}`}
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <span
                    className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                      done ? 'bg-gov-cyan border-gov-cyan text-white' : current ? 'bg-gov-navy border-gov-navy text-white' : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={`text-[10px] text-center mt-1 leading-tight max-w-[5rem] ${current ? 'text-gov-navy font-bold' : 'text-gray-500'}`}>
                    {e.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-bold uppercase text-gray-500">
          Estado del expediente <span className="ml-1 text-[10px] font-semibold text-gov-blue bg-sky-50 border border-sky-100 rounded-full px-1.5 py-0.5" title="Catálogo administrable por un usuario Admin">⚙ admin</span>
        </label>
        <select
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-gov-navy disabled:opacity-60"
          value={checklist.estado_expediente_id ?? ''}
          disabled={!canEdit}
          onChange={(e) => onUpdateEstado(Number(e.target.value))}
        >
          <option value="" disabled>Sin definir</option>
          {estados.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function StatTile({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wide">{label}</div>
      <div className={`text-sm font-bold ${mono ? 'font-mono' : ''} ${value ? 'text-gov-navy' : 'text-gray-300'}`}>{value || '—'}</div>
    </div>
  )
}

function StatusPill({
  valor, canEdit, onChange,
}: {
  valor: ValorItemChecklist
  canEdit: boolean
  onChange: (v: ValorItemChecklist) => void
}) {
  const [open, setOpen] = useState(false)
  const meta = STATUS_META[valor]
  if (!canEdit) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.fg }}>
        {meta.label}
      </span>
    )
  }
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 hover:brightness-95"
        style={{ background: meta.bg, color: meta.fg }}
        onClick={() => setOpen((o) => !o)}
      >
        {meta.label}
        <span className="opacity-60">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[13rem] z-40">
            {STATUS_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-gray-700 hover:bg-slate-50 text-left"
                onClick={() => { onChange(k); setOpen(false) }}
              >
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: STATUS_META[k].fg }} />
                {STATUS_META[k].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function findItem(items: ChecklistItemDetalle[], itemNum: number, subItemNum: number | null) {
  return items.find((i) => i.item_num === itemNum && i.sub_item_num === subItemNum)
}

function ChecklistCard({
  checklist, itemsDef, canEdit, onChangeItem,
}: {
  checklist: ChecklistTecnico
  itemsDef: ItemDefinicion[]
  canEdit: boolean
  onChangeItem: (itemNum: number, subItemNum: number | null, valor: ValorItemChecklist) => void
}) {
  const [openDisclosure, setOpenDisclosure] = useState(false)
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gov-navy">Documentación a presentar</h3>
      </div>
      <div className="px-4 pt-3 pb-1 flex gap-3 flex-wrap">
        {STATUS_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_META[k].fg }} />
            {STATUS_META[k].label}
          </span>
        ))}
      </div>
      <div className="pb-2">
        {itemsDef.map((def) => {
          const item = findItem(checklist.items, def.item_num, null)
          return (
            <div key={def.item_num}>
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-50 first:border-t-0">
                <span className="text-sm text-gray-700">{def.item_num}. {def.label}</span>
                {item && (
                  <StatusPill valor={item.valor} canEdit={canEdit} onChange={(v) => onChangeItem(def.item_num, null, v)} />
                )}
              </div>
              {def.sub_items && (
                <>
                  <button
                    type="button"
                    className="w-full flex items-center gap-1.5 px-4 py-2 border-t border-slate-50 text-xs font-semibold text-gov-blue text-left"
                    onClick={() => setOpenDisclosure((o) => !o)}
                  >
                    <span className={`inline-block transition-transform ${openDisclosure ? 'rotate-90' : ''}`}>▸</span>
                    Detalle técnico ({def.sub_items.length} ítems{def.sub_items.length ? ', cada uno independiente' : ''})
                  </button>
                  {openDisclosure && def.sub_items.map((sub) => {
                    const subItem = findItem(checklist.items, def.item_num, sub.sub_item_num)
                    return (
                      <div key={sub.sub_item_num} className="flex items-center justify-between gap-3 pl-8 pr-4 py-2 border-t border-slate-50">
                        <span className="text-sm text-gray-600">{sub.label}</span>
                        {subItem && (
                          <StatusPill
                            valor={subItem.valor}
                            canEdit={canEdit}
                            onChange={(v) => onChangeItem(def.item_num, sub.sub_item_num, v)}
                          />
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HitosCard({
  hitos, canEdit, onChangeFecha,
}: {
  hitos: NonNullable<ChecklistTecnico['hitos']>
  canEdit: boolean
  onChangeFecha: (tipo: TipoHitoChecklist, fecha: string | null) => void
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gov-navy">Ejecución de obra</h3>
        <span className="text-[11px] text-gray-400">montos calculados sobre el convenio</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {hitos.map((h) => {
          const paid = !!h.fecha_acreditado
          return (
            <div key={h.tipo} className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${paid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-gray-500'}`}>
                  {paid ? '✓' : HITO_LABEL[h.tipo].charAt(0)}
                </span>
                <span className="text-xs font-semibold text-gray-700">{h.label}</span>
              </div>
              <div className="text-base font-bold text-gov-navy font-mono">{h.monto !== null ? fmtMonto(h.monto) : '—'}</div>
              <input
                type="date"
                className="mt-2 w-full border border-gray-200 rounded-md px-2 py-1 text-xs disabled:opacity-60"
                value={h.fecha_acreditado ?? ''}
                disabled={!canEdit}
                onChange={(e) => onChangeFecha(h.tipo, e.target.value || null)}
              />
              <div className={`text-[11px] mt-1 font-semibold ${paid ? 'text-green-600' : 'text-gray-400'}`}>
                {paid ? `Acreditado ${fmtFecha(h.fecha_acreditado)}` : 'Pendiente de pago'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RadicadoCard({
  checklist, canEdit, reparticiones, onUpdate,
}: {
  checklist: ChecklistTecnico
  canEdit: boolean
  reparticiones: { id: number; label: string }[]
  onUpdate: (data: { fecha_radicacion?: string | null; reparticion_id?: number | null }) => void
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gov-navy">Expediente radicado en</h3>
        <span className="text-[10px] font-semibold text-gov-blue bg-sky-50 border border-sky-100 rounded-full px-1.5 py-0.5" title="Catálogo administrable por un usuario Admin — puede variar por programa">⚙ admin</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase text-gray-400 w-24 flex-shrink-0">Fecha</label>
          <input
            type="date"
            className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
            value={checklist.fecha_radicacion ?? ''}
            disabled={!canEdit}
            onChange={(e) => onUpdate({ fecha_radicacion: e.target.value || null })}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase text-gray-400 w-24 flex-shrink-0">Repartición</label>
          <select
            className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
            value={checklist.reparticion_id ?? ''}
            disabled={!canEdit}
            onChange={(e) => onUpdate({ reparticion_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Sin radicar</option>
            {reparticiones.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function ObservacionesCard({
  programa, entidadId, canEdit,
}: {
  programa: ProgramaChecklist
  entidadId: string
  canEdit: boolean
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const queryKey = ['checklist-tecnico-pedidos', programa, entidadId]

  const { data: pedidos } = useQuery({
    queryKey,
    queryFn: () => checklistTecnicoApi.getPedidos(programa, entidadId),
  })

  const createMut = useMutation({
    mutationFn: () => checklistTecnicoApi.createPedido(programa, entidadId, { descripcion: texto, fecha_pedido: fecha }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setTexto('')
      setFecha(todayISO())
      setOpen(false)
    },
  })

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gov-navy">Observaciones</h3>
        <span className="text-[11px] text-gray-400">{pedidos?.length ?? 0}</span>
      </div>

      {canEdit && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full border-2 border-dashed border-sky-200 rounded-lg py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
            >
              + Nueva actualización
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm min-h-[4.5rem]"
                placeholder="Describí la comunicación o el avance…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500">Fecha</label>
                <input type="date" className="border border-sky-200 rounded-md px-2 py-1 text-xs" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="text-xs border border-gray-200 rounded-md px-3 py-1.5 text-gray-600" onClick={() => { setOpen(false); setTexto('') }}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!texto.trim() || createMut.isPending}
                  className="text-xs font-semibold bg-gov-navy text-white rounded-md px-3 py-1.5 disabled:opacity-50"
                  onClick={() => createMut.mutate()}
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ul className="max-h-96 overflow-y-auto p-4 space-y-3">
        {(!pedidos || pedidos.length === 0) && <li className="text-center text-sm text-gray-400 py-4">Sin observaciones registradas aún.</li>}
        {pedidos?.map((p) => (
          <li key={p.id} className="flex gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gov-cyan mt-1.5 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-gov-navy">{fmtFecha(p.fecha_pedido)}</div>
              <p className="text-sm text-gray-700 mt-0.5">{p.descripcion}</p>
              {(p.created_by_nombre || p.created_by) && (
                <p className="text-[11px] text-gray-400 mt-0.5">{p.created_by_nombre || p.created_by}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
