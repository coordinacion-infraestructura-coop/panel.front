// Nivel 1 (Provincia) del tablero territorial — mapa coroplético con selector
// de métrica, KPIs de cabecera y gráfico de focalización ATP por
// departamento. Spec: docs/files/spec-resumen-territorial-tablero-v2.md §4
// (Etapa 3). El nivel Departamento (zoom + burbujas) y el nivel Localidad
// (ficha) son etapas separadas (4 y 5) — acá sólo se resuelve la vista
// provincial y el filtro bidireccional mapa↔tabla.
import { useMemo, useState } from 'react'
import { CoropletiqueDepartamentos, colorDivergente, type DatoMapa } from '../../../shared/components/informe/CoropletiqueDepartamentos'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'
import { calcularDepartamentos, calcularKpisProvincia } from '../utils/departamentoAgregados'
import type { ResumenTerritorialPayload } from '../types/resumenTerritorial.types'

type MetricaProvincia = 'promedio_programas' | 'gestiones_10k_hab' | 'pct_cobertura' | 'focalizacion_atp'

const METRICAS: { id: MetricaProvincia; label: string; corta: string }[] = [
  { id: 'promedio_programas', label: 'Programas distintos por localidad', corta: 'Programas/localidad' },
  { id: 'gestiones_10k_hab', label: 'Gestiones cada 10.000 hab.', corta: 'Gestiones /10k hab' },
  { id: 'pct_cobertura', label: 'Cobertura del departamento', corta: 'Cobertura %' },
  { id: 'focalizacion_atp', label: 'Focalización ATP (vs. población)', corta: 'Focalización ATP' },
]

const fmtInt = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('es-AR'))
const fmtMoney = (n: number | null) => (n == null ? '—' : `$ ${Math.round(n).toLocaleString('es-AR')}`)
const fmtPct = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('es-AR')}%`)

function formatValorMetrica(metrica: MetricaProvincia, v: number): string {
  switch (metrica) {
    case 'pct_cobertura':
      return `${v.toFixed(1)}%`
    case 'focalizacion_atp':
      return v.toFixed(2)
    default:
      return v.toFixed(1)
  }
}

export function VistaProvincia({
  payload,
  departamentoSeleccionado,
  onSelectDepartamento,
}: {
  payload: ResumenTerritorialPayload
  departamentoSeleccionado: string | null
  onSelectDepartamento: (departamento: string) => void
}) {
  const [metrica, setMetrica] = useState<MetricaProvincia>('promedio_programas')

  const deptos = useMemo(() => calcularDepartamentos(payload), [payload])
  const kpis = useMemo(() => calcularKpisProvincia(payload), [payload])

  const mapData: DatoMapa[] = useMemo(
    () =>
      deptos.map((d) => ({
        departamento: d.departamento,
        // shape legado (tooltip de cantidad/pct_cobertura reusa estos campos)
        cantidad: d.total_programas,
        localidades_cubiertas: d.localidades_con_datos,
        localidades_totales: d.localidades_totales,
        // métricas nuevas de Etapa 3
        promedio_programas: d.promedio_programas,
        gestiones_10k_hab: d.gestiones_10k_hab,
        pct_cobertura: d.pct_cobertura,
        focalizacion_atp: d.focalizacion_atp,
      })),
    [deptos],
  )

  const metricaInfo = METRICAS.find((m) => m.id === metrica)!

  const kpiItems: Kpi[] = [
    { value: fmtInt(kpis.poblacion_2022), label: 'Población (Censo 2022)', accent: 'navy' },
    { value: fmtPct(kpis.pct_cobertura), label: 'Cobertura territorial', accent: 'cyan' },
    {
      value: fmtMoney(kpis.transferencias_total),
      label: kpis.transferencias_periodo
        ? `Transferencias · ${kpis.transferencias_periodo}`
        : 'Transferencias automáticas',
      accent: 'green',
    },
    { value: fmtMoney(kpis.transferencias_per_capita), label: 'Transferencias per cápita', accent: 'green' },
    { value: fmtMoney(kpis.atp_monto_per_capita), label: 'Inversión ATP per cápita', accent: 'orange' },
    { value: 'N/D', label: 'Densidad — falta superficie', accent: 'navy' },
    { value: 'N/D', label: 'Crecim. intercensal — falta Censo 2010', accent: 'navy' },
  ]

  // Focalización ATP por departamento — sólo los que tienen dato (con
  // población y algo de ATP en algún lado de la provincia), ordenados de
  // menor a mayor para que el patrón "quién recibe de más/de menos" se lea
  // de un vistazo en la barra horizontal.
  const focalizacion = deptos
    .filter((d) => d.focalizacion_atp !== null)
    .sort((a, b) => (a.focalizacion_atp ?? 0) - (b.focalizacion_atp ?? 0))

  return (
    <div className="space-y-4">
      <KpiStrip items={kpiItems} />

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-gov-navy">Mapa por departamento</p>
          <div className="inline-flex flex-wrap bg-slate-100 border border-slate-300 rounded-lg p-0.5">
            {METRICAS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetrica(m.id)}
                className={`px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap ${
                  metrica === m.id ? 'bg-gov-cyan text-white' : 'text-gray-600'
                }`}
              >
                {m.corta}
              </button>
            ))}
          </div>
        </div>
        <CoropletiqueDepartamentos
          data={mapData}
          metrica={metrica}
          escala={metrica === 'focalizacion_atp' ? 'divergente' : 'secuencial'}
          centroDivergente={1}
          label={metricaInfo.corta}
          formatValor={(v) => formatValorMetrica(metrica, v)}
          seleccionado={departamentoSeleccionado}
          onDepartamentoClick={onSelectDepartamento}
          height={440}
        />
        <p className="text-[11px] text-gray-400 mt-2">
          {metricaInfo.label}. Clic en un departamento para filtrar la tabla de abajo por esa zona.
          {metrica === 'focalizacion_atp' &&
            ' Índice = % de la inversión ATP que recibió el depto / % de la población provincial que vive ahí — 1.00 es proporcional.'}
        </p>
      </div>

      {focalizacion.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-gov-navy mb-1">Focalización ATP por departamento</p>
          <p className="text-[11px] text-gray-400 mb-3">
            &gt; 1.00: el departamento recibió más ATP del que le tocaría por población · &lt; 1.00: menos.
          </p>
          <BarChart
            labels={focalizacion.map((d) => d.departamento)}
            values={focalizacion.map((d) => d.focalizacion_atp ?? 0)}
            colors={focalizacion.map((d) => colorDivergente(d.focalizacion_atp ?? 1, 1))}
            horizontal
            height={Math.max(220, focalizacion.length * 26)}
          />
        </div>
      )}
    </div>
  )
}
