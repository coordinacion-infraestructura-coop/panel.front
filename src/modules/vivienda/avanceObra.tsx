// Avance físico de obra + hitos (Anticipo / 40 / 70 / 100) de los paneles CC / CH / ML y del
// Checklist Técnico (docs/files/spec-checklist-tecnico-dgv.md v1.6.0 §5.6 / §6-bis).
// Los paneles sólo LEEN estos datos: se cargan en el Checklist Técnico. Mismas reglas de
// situación en todas las vistas (tabla, filtro, Excel, detalle).
import type { HitoObraPanel, ObraPanel, TipoHitoChecklist } from './types/vivienda.types'

export const LEYENDA_OBRA = 'Se carga en el Checklist Técnico'

export const HITO_CORTO: Record<TipoHitoChecklist, string> = {
  anticipo: 'Ant', '40': '40', '70': '70', '100': '100',
}
export const HITO_NOMBRE: Record<TipoHitoChecklist, string> = {
  anticipo: 'Anticipo financiero', '40': 'Avance 40%', '70': 'Avance 70%', '100': 'Avance 100%',
}
const MARCAS = [40, 70, 100]

/** 'YYYY-MM-DD' → 'dd/mm/aaaa' sin pasar por Date (evita el corrimiento de zona horaria). */
export function fmtFechaObra(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtMontoObra(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

// ── Situación de la obra y de cada hito ──────────────────────────────────────

export type SituacionObra = 'sin_medicion' | 'en_ejecucion' | 'terminada'
export const SITUACION_OBRA_LABEL: Record<SituacionObra, string> = {
  sin_medicion: 'Sin medición', en_ejecucion: 'En ejecución', terminada: 'Terminada',
}

export function situacionObra(o: ObraPanel): SituacionObra {
  if (o.fecha_fin_obra) return 'terminada'
  if (o.avance_obra_pct !== null && o.avance_obra_pct !== undefined) return 'en_ejecucion'
  return 'sin_medicion'
}

export type SituacionHito = 'pagado' | 'medido' | 'pendiente'

export function situacionHito(h: Pick<HitoObraPanel, 'fecha_acreditado' | 'fecha_medicion'>): SituacionHito {
  if (h.fecha_acreditado) return 'pagado'
  if (h.fecha_medicion) return 'medido'
  return 'pendiente'
}

const HITO_COLOR: Record<SituacionHito, string> = {
  pagado: 'bg-green-100 text-green-700 border-green-200',
  medido: 'bg-amber-100 text-amber-700 border-amber-200',
  pendiente: 'bg-slate-50 text-slate-400 border-slate-200',
}

/** Obra iniciada = hay alguna medición o algún hito con fecha (spec §6-bis). */
export function obraIniciada(o: ObraPanel): boolean {
  if (o.avance_obra_pct !== null && o.avance_obra_pct !== undefined) return true
  return (o.hitos_obra ?? []).some((h) => h.fecha_acreditado || h.fecha_medicion)
}

// ── Barra de avance ──────────────────────────────────────────────────────────

export function AvanceBar({
  pct, fecha, compact = false,
}: { pct: number | null | undefined; fecha?: string | null; compact?: boolean }) {
  if (pct === null || pct === undefined) {
    return <span className="text-gray-400 text-xs">{compact ? '—' : 'Sin medición'}</span>
  }
  const color = pct >= 100 ? 'bg-green-500' : 'bg-gov-cyan'
  return (
    <div className={compact ? 'min-w-[96px]' : 'w-full'}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-bold text-gov-navy ${compact ? 'text-xs' : 'text-sm'}`}>{pct}%</span>
        {fecha && <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtFechaObra(fecha)}</span>}
      </div>
      <div className={`relative w-full bg-slate-100 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2.5'} mt-0.5`}>
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
        {!compact && MARCAS.slice(0, 2).map((m) => (
          <div key={m} className="absolute top-0 h-full w-px bg-white/90" style={{ left: `${m}%` }} />
        ))}
      </div>
      {!compact && (
        <div className="relative h-3 text-[9px] text-gray-400">
          {MARCAS.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: `${m === 100 ? 97 : m}%` }}>{m}%</span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Celda de tabla: barra compacta, o "✓ Terminada dd/mm" si hay fecha de fin. */
export function AvanceCelda({ o }: { o: ObraPanel }) {
  if (o.fecha_fin_obra) {
    return (
      <span className="text-xs font-semibold text-green-700 whitespace-nowrap" title={`Avance ${o.avance_obra_pct ?? '—'}%`}>
        ✓ Terminada {fmtFechaObra(o.fecha_fin_obra)}
      </span>
    )
  }
  return <AvanceBar pct={o.avance_obra_pct} fecha={o.avance_obra_fecha} compact />
}

// ── Hitos ────────────────────────────────────────────────────────────────────

function tooltipHito(h: HitoObraPanel): string {
  const partes = [HITO_NOMBRE[h.tipo], `Monto: ${fmtMontoObra(h.monto)}`]
  if (h.tipo !== 'anticipo') {
    partes.push(h.fecha_medicion ? `Medido: ${fmtFechaObra(h.fecha_medicion)}` : 'Pendiente de medición')
  }
  partes.push(h.fecha_acreditado ? `Pagado: ${fmtFechaObra(h.fecha_acreditado)}` : 'Pendiente de pago')
  return partes.join('\n')
}

/** Columna "Hitos" de la tabla: 4 chips coloreados por situación; "—" si la obra no empezó. */
export function HitosChips({ o }: { o: ObraPanel }) {
  if (!o.hitos_obra || !obraIniciada(o)) return <span className="text-gray-400 text-xs">—</span>
  return (
    <div className="flex gap-0.5">
      {o.hitos_obra.map((h) => (
        <span
          key={h.tipo}
          title={tooltipHito(h)}
          className={`inline-block border rounded px-1 py-0.5 text-[10px] font-bold leading-none ${HITO_COLOR[situacionHito(h)]}`}
        >
          {HITO_CORTO[h.tipo]}
        </span>
      ))}
    </div>
  )
}

/** Bloque de solo lectura para el DetailPanel: barra + fecha de fin + 4 tarjetas de hito. */
export function ObraResumen({ o }: { o: ObraPanel }) {
  const aviso = o.fecha_fin_obra && (o.avance_obra_pct ?? 0) < 100
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">Avance físico de obra</p>
        <AvanceBar pct={o.avance_obra_pct} fecha={o.avance_obra_fecha} />
      </div>
      <div className="text-xs">
        <span className="font-bold uppercase text-gray-400 text-[11px]">Fin de obra: </span>
        {o.fecha_fin_obra ? <span className="font-semibold text-green-700">{fmtFechaObra(o.fecha_fin_obra)}</span> : <span className="text-gray-400">—</span>}
        {aviso && <span className="ml-2 text-amber-600">⚠ la última medición es menor a 100%</span>}
      </div>
      {o.hitos_obra && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {o.hitos_obra.map((h) => {
            const sit = situacionHito(h)
            return (
              <div key={h.tipo} className={`border rounded-lg p-2 ${HITO_COLOR[sit]}`}>
                <p className="text-[11px] font-bold">{HITO_NOMBRE[h.tipo]}</p>
                <p className="text-xs font-mono text-gov-navy">{fmtMontoObra(h.monto)}</p>
                {h.tipo !== 'anticipo' && (
                  <p className="text-[10px] mt-0.5">{h.fecha_medicion ? `Medido ${fmtFechaObra(h.fecha_medicion)}` : 'Pendiente de medición'}</p>
                )}
                <p className="text-[10px]">{h.fecha_acreditado ? `Pagado ${fmtFechaObra(h.fecha_acreditado)}` : 'Pendiente de pago'}</p>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-gray-400">{LEYENDA_OBRA}</p>
    </div>
  )
}

// ── Exportación a Excel (14 columnas) ────────────────────────────────────────

/** 'YYYY-MM-DD' → Date local (xlsx la escribe como fecha de Excel). */
function fechaExcel(iso: string | null | undefined): Date | '' {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function obraColumnasExcel(o: ObraPanel): Record<string, number | Date | string> {
  const hito = (t: TipoHitoChecklist) => o.hitos_obra?.find((h) => h.tipo === t)
  const cols: Record<string, number | Date | string> = {
    'Avance obra %': o.avance_obra_pct ?? '',
    'Fecha última medición': fechaExcel(o.avance_obra_fecha),
    'Fecha fin de obra': fechaExcel(o.fecha_fin_obra),
  }
  const ant = hito('anticipo')
  cols['Anticipo — monto'] = ant?.monto ?? ''
  cols['Anticipo — fecha pago'] = fechaExcel(ant?.fecha_acreditado)
  for (const t of ['40', '70', '100'] as const) {
    const h = hito(t)
    cols[`${t}% — monto`] = h?.monto ?? ''
    cols[`${t}% — fecha medición`] = fechaExcel(h?.fecha_medicion)
    cols[`${t}% — fecha pago`] = fechaExcel(h?.fecha_acreditado)
  }
  return cols
}
