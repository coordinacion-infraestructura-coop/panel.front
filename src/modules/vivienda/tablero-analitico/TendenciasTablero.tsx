import { useMemo } from 'react'
import { LineChart } from '../../../shared/components/informe/LineChart'
import { fmtFechaObra } from '../avanceObra'
import type { KpisDia, PuntoTendencia } from './tableroAnalitico.api'

const SERIES: { clave: keyof KpisDia; titulo: string; color: string; escala?: number; unidad?: string }[] = [
  { clave: 'programas_activos', titulo: 'Expedientes activos', color: '#398ebd' },
  { clave: 'localidades', titulo: 'Localidades', color: '#0d9488' },
  { clave: 'departamentos', titulo: 'Departamentos', color: '#7c3aed' },
  { clave: 'localidades_items_faltantes', titulo: 'Localidades con ítems faltantes', color: '#e11d48' },
  { clave: 'comunicaciones_30d', titulo: 'Comunicaciones · 30 días', color: '#16a34a' },
  { clave: 'monto_total', titulo: 'Monto total (millones de $)', color: '#d17612', escala: 1e6 },
  { clave: 'avance_obra_promedio', titulo: 'Avance de obra promedio (%)', color: '#172c3f' },
]

export const RANGOS = [30, 90, 180] as const

export function TendenciasTablero({
  serie,
  cargando,
  dias,
  onDias,
}: {
  serie: PuntoTendencia[]
  cargando: boolean
  dias: number
  onDias: (d: number) => void
}) {
  const labels = useMemo(() => serie.map((p) => fmtFechaObra(p.fecha).slice(0, 5)), [serie])
  const valores = useMemo(
    () =>
      Object.fromEntries(
        SERIES.map((s) => [
          s.clave,
          serie.map((p) => {
            const v = p.kpis[s.clave]
            return typeof v === 'number' ? Math.round((v / (s.escala ?? 1)) * 10) / 10 : NaN
          }),
        ]),
      ) as Record<string, number[]>,
    [serie],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gov-navy">Tendencias históricas</p>
          <p className="text-[11px] text-gray-400">
            Toda la provincia, sin filtros: un punto por día (el último cálculo de cada día del Resumen Territorial).
          </p>
        </div>
        <div className="inline-flex bg-slate-100 border border-slate-200 rounded-full p-0.5" role="group" aria-label="Rango">
          {RANGOS.map((r) => (
            <button key={r} type="button" onClick={() => onDias(r)} aria-pressed={dias === r}
              className={`px-3 py-1 text-xs rounded-full ${dias === r ? 'bg-gov-cyan text-white shadow-sm' : 'text-gray-600'}`}>
              {r} días
            </button>
          ))}
        </div>
      </div>
      {cargando ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : serie.length === 0 ? (
        <p className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-gray-400">
          Todavía no hay historia para este rango.
        </p>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          {SERIES.map((s) => (
            <div key={s.clave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.titulo}
              </p>
              <LineChart labels={labels} values={valores[s.clave]} color={s.color} height={200} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
