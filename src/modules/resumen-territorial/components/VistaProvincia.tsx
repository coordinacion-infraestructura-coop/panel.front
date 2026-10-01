// Nivel 1 (Provincia) del tablero territorial — mapa coroplético con selector
// de métrica, KPIs de cabecera y gráfico de focalización ATP por
// departamento. Spec: docs/files/spec-resumen-territorial-tablero-v2.md §4
// (Etapa 3). El nivel Departamento (zoom + burbujas) y el nivel Localidad
// (ficha) son etapas separadas (4 y 5) — acá sólo se resuelve la vista
// provincial y el filtro bidireccional mapa↔tabla.
//
// El mapa sólo hace zoom a nivel DEPARTAMENTO — el zoom a punto de una
// localidad se sacó (feedback QA visual): un choropleth de departamentos no
// tiene nada que mostrar zoomado a nivel calle, sólo queda un color plano
// gigante sin contexto. El detalle de una localidad puntual vive en
// FichaLocalidadModal, no en este mapa.
import { useMemo, useState } from 'react'
import { CoropletiqueDepartamentos, colorDivergente, type DatoMapa } from '../../../shared/components/informe/CoropletiqueDepartamentos'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'
import { calcularDepartamentos, calcularKpisProvincia } from '../utils/departamentoAgregados'
import type { ResumenTerritorialPayload } from '../types/resumenTerritorial.types'

type MetricaProvincia = 'promedio_programas' | 'gestiones_10k_hab' | 'pct_cobertura' | 'focalizacion_atp'

const METRICAS: { id: MetricaProvincia; label: string; corta: string; explicacion: string }[] = [
  {
    id: 'promedio_programas',
    label: 'Programas distintos por localidad',
    corta: 'Programas/localidad',
    explicacion:
      'Promedio de líneas de programa (Vivienda CC/CH/ML, Privada, Gasífera, ATP) por localidad del departamento — total de líneas ÷ cantidad de localidades del padrón.',
  },
  {
    id: 'gestiones_10k_hab',
    label: 'Gestiones cada 10.000 hab.',
    corta: 'Gestiones /10k hab',
    explicacion:
      'Total de líneas de programa del departamento, llevado a una base comparable de 10.000 habitantes — total de líneas ÷ población del depto × 10.000.',
  },
  {
    id: 'pct_cobertura',
    label: 'Cobertura del departamento',
    corta: 'Cobertura %',
    explicacion:
      '% de localidades del departamento con al menos un registro en alguna fuente (Vivienda, Privada, ATP, Gas), sobre el total de localidades del padrón geográfico.',
  },
  {
    id: 'focalizacion_atp',
    label: 'Focalización ATP (vs. población)',
    corta: 'Focalización ATP',
    explicacion:
      '% de la inversión ATP que recibió el departamento ÷ % de la población provincial que vive ahí. 1.00 = proporcional a su población; > 1.00 recibió de más, < 1.00 de menos.',
  },
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

  // El mapa y el gráfico de focalización son comparativos — siempre muestran
  // los 26 departamentos entre sí, elegir uno no los recorta (perderían el
  // punto de comparación). Los KPIs de cabecera sí recalculan para la zona
  // elegida: bug real encontrado en QA visual, antes siempre mostraban el
  // total de toda la provincia aunque hubiera un departamento seleccionado.
  const deptos = useMemo(() => calcularDepartamentos(payload), [payload])

  const payloadKpis = useMemo(() => {
    if (!departamentoSeleccionado) return payload
    return {
      ...payload,
      localidades: payload.localidades.filter((l) => l.departamento === departamentoSeleccionado),
      total_localidades_por_departamento: departamentoSeleccionado in payload.total_localidades_por_departamento
        ? { [departamentoSeleccionado]: payload.total_localidades_por_departamento[departamentoSeleccionado] }
        : {},
    }
  }, [payload, departamentoSeleccionado])
  const kpis = useMemo(() => calcularKpisProvincia(payloadKpis), [payloadKpis])

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

  const kpiGlosario: { label: string; explicacion: string }[] = [
    { label: 'Población (Censo 2022)', explicacion: 'Habitantes del padrón oficial (Censo Nacional 2022) de la zona.' },
    {
      label: 'Cobertura territorial',
      explicacion: 'Localidades de la zona con al menos un registro en algún programa/fuente, sobre el total del padrón.',
    },
    {
      label: 'Transferencias',
      explicacion:
        'Suma de transferencias automáticas provinciales a municipios/comunas (Coparticipación Ley 8663, FASAMU, FOFINDES, Fondo de Compensación) del último período cargado.',
    },
    { label: 'Transferencias per cápita', explicacion: 'Transferencias totales ÷ población de la zona.' },
    { label: 'Inversión ATP per cápita', explicacion: 'Monto total comprometido en ATP ÷ población de la zona.' },
    {
      label: 'Densidad / Crecim. intercensal',
      explicacion: 'No disponibles todavía — falta la fuente de superficie por departamento y el Censo 2010.',
    },
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
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {departamentoSeleccionado ? `Indicadores — ${departamentoSeleccionado}` : 'Indicadores — toda la provincia'}
        </p>
        <KpiStrip items={kpiItems} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-400">
          {kpiGlosario.map((k) => (
            <li key={k.label}>
              <span className="font-semibold text-gray-500">{k.label}:</span> {k.explicacion}
            </li>
          ))}
        </ul>
      </div>

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
        <p className="text-[11px] text-gray-500 mt-2">
          Clic en un departamento, o elegí uno arriba en "Ir a", para hacer zoom y recalcular los
          indicadores de esa zona.
        </p>
        <ul className="mt-1 space-y-0.5">
          {METRICAS.map((m) => (
            <li
              key={m.id}
              className={`text-[11px] ${metrica === m.id ? 'text-gray-600' : 'text-gray-400'}`}
            >
              <span className={`font-semibold ${metrica === m.id ? 'text-gov-navy' : 'text-gray-500'}`}>
                {m.corta}:
              </span>{' '}
              {m.explicacion}
            </li>
          ))}
        </ul>
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
