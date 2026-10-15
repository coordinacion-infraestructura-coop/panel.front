// Área responsable de cada estado del catálogo (CC / CH / ML) y filtro "Documentación" de los
// paneles (docs/files/spec-vivienda-tablero-analitico.md §8). Compartido por los 3 paneles.
import type { AreaResponsable, ObraPanel } from './types/vivienda.types'

export type { AreaResponsable }

export const AREA_RESPONSABLE_LABEL: Record<AreaResponsable, string> = {
  juridica: 'Jurídica', tecnica: 'Técnica', financiera: 'Financiera', externa: 'Externa',
}
const AREA_CORTO: Record<AreaResponsable, string> = { juridica: 'J', tecnica: 'T', financiera: 'F', externa: 'Ext' }
const AREA_CLS: Record<AreaResponsable, string> = {
  juridica: 'bg-amber-100 text-amber-800',
  tecnica: 'bg-sky-100 text-sky-800',
  financiera: 'bg-emerald-100 text-emerald-800',
  externa: 'bg-slate-200 text-slate-700',
}

interface ConArea {
  label: string
  area_responsable?: AreaResponsable | null
}

/** Texto de una opción de desplegable: "[T] En corrección". Sin área, el label tal cual. */
export function labelConArea(e: ConArea): string {
  return e.area_responsable ? `[${AREA_CORTO[e.area_responsable]}] ${e.label}` : e.label
}

/** Tooltip del chip de estado. */
export function tituloConArea(e: ConArea): string {
  return e.area_responsable ? `${e.label} — Área: ${AREA_RESPONSABLE_LABEL[e.area_responsable]}` : e.label
}

export function AreaBadge({ area }: { area?: AreaResponsable | null }) {
  if (!area) return null
  return (
    <span title={`Área: ${AREA_RESPONSABLE_LABEL[area]}`} className={`px-1 rounded text-[10px] font-semibold ${AREA_CLS[area]}`}>
      {AREA_CORTO[area]}
    </span>
  )
}

export function AreaResponsableSelect({
  value,
  onChange,
  className,
}: {
  value: AreaResponsable | null | undefined
  onChange: (v: AreaResponsable | null) => void
  className?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Área responsable</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as AreaResponsable | null)}
        className={className ?? 'w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'}
      >
        <option value="">— Sin asignar —</option>
        {(Object.keys(AREA_RESPONSABLE_LABEL) as AreaResponsable[]).map((a) => (
          <option key={a} value={a}>{AREA_RESPONSABLE_LABEL[a]}</option>
        ))}
      </select>
    </label>
  )
}

// ── Documentación (checklist sin los "No Aplica") ────────────────────────────

export type DocumentacionPanel = 'completa' | 'incompleta' | 'no_iniciada'
export const DOCUMENTACION_PANEL_LABEL: Record<DocumentacionPanel, string> = {
  completa: 'Completa', incompleta: 'Incompleta', no_iniciada: 'No iniciada',
}

export function documentacionPanel(o: ObraPanel): DocumentacionPanel {
  if (!o.doc_iniciado || o.doc_total === null || o.doc_total === undefined) return 'no_iniciada'
  return (o.doc_completos ?? 0) >= o.doc_total ? 'completa' : 'incompleta'
}
