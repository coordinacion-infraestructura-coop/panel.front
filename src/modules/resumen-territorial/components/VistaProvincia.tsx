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
import { calcularDepartamentos, calcularFocalizacionPorLocalidad, calcularKpisProvincia } from '../utils/departamentoAgregados'
import type { ResumenLocalidad, ResumenTerritorialPayload } from '../types/resumenTerritorial.types'
import {
  IndicadoresPrincipales,
  contarProgramasAgregado,
  type ComparativaPerCapita,
} from './IndicadoresPrincipalesLocalidad'

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
  kpisTabla,
  localidadesFiltradas,
  localidadSeleccionada,
}: {
  payload: ResumenTerritorialPayload
  departamentoSeleccionado: string | null
  onSelectDepartamento: (departamento: string) => void
  /** KPIs de la tabla general (versión anterior de Resumen Territorial) — se
   * muestran debajo de los indicadores nuevos y antes del mapa, a pedido del
   * usuario (no se recalculan acá, vienen ya armados de ResumenTerritorialPage
   * sobre `localidadesFiltradas`). */
  kpisTabla?: Kpi[]
  /** Mismo conjunto ya filtrado (búsqueda + depto + localidad + área/programa/
   * estado/checklist/visita) que alimenta `kpisTabla` — los indicadores de
   * arriba (población, cobertura, transferencias, ATP) se recalculan sobre
   * este conjunto en vez de filtrar sólo por departamento acá adentro, para
   * que CUALQUIER filtro (incluida la localidad puntual) los afecte. Antes
   * sólo reaccionaban a `departamentoSeleccionado` — bug real reportado
   * 2026-10-01: elegir una localidad no cambiaba los indicadores nuevos. */
  localidadesFiltradas?: ResumenLocalidad[]
  /** Localidad puntual elegida en "Ir a" (fLocActivo de ResumenTerritorialPage).
   * Los Indicadores Principales (pedido 2026-10-01) están SIEMPRE visibles —
   * se adaptan a la escala activa: provincia sin filtro, el departamento si
   * `departamentoSeleccionado` está puesto sin localidad, o esta localidad
   * puntual si está presente. */
  localidadSeleccionada?: ResumenLocalidad | null
}) {
  const [metrica, setMetrica] = useState<MetricaProvincia>('promedio_programas')
  // Switch del gráfico de ATP (pedido 2026-10-01) — nominal ($ en millones)
  // por default, focalización (%/%) como alternativa.
  const [vistaAtp, setVistaAtp] = useState<'nominal' | 'focalizacion'>('nominal')

  // El mapa es comparativo — siempre muestra los 26 departamentos entre sí,
  // elegir uno no lo recorta (perdería el punto de comparación). Los KPIs de
  // cabecera sí recalculan para la selección actual (ver `localidadesFiltradas`
  // arriba).
  const deptos = useMemo(() => calcularDepartamentos(payload), [payload])

  // Indicadores Principales (pedido 2026-10-01) — SIEMPRE visibles, en 3
  // escalas posibles (provincia/departamento/localidad, la más específica
  // que esté activa). SIEMPRE calculados sobre el payload completo sin
  // filtrar — el promedio departamental/provincial de la comparativa per
  // cápita tiene que ser el real, nunca uno recortado por otros filtros.
  const kpisProvinciaCompleta = useMemo(() => calcularKpisProvincia(payload), [payload])
  const departamentoDeLocalidadSeleccionada = localidadSeleccionada
    ? deptos.find((d) => d.departamento === localidadSeleccionada.departamento) ?? null
    : null
  const departamentoAgregadoActivo = departamentoSeleccionado
    ? deptos.find((d) => d.departamento === departamentoSeleccionado) ?? null
    : null

  const tituloIndicadores = localidadSeleccionada
    ? localidadSeleccionada.localidad
    : departamentoSeleccionado
      ? `Departamento ${departamentoSeleccionado}`
      : 'Toda la provincia'

  const conteosIndicadores = useMemo(() => {
    if (localidadSeleccionada) return contarProgramasAgregado([localidadSeleccionada])
    if (departamentoSeleccionado) {
      return contarProgramasAgregado(payload.localidades.filter((l) => l.departamento === departamentoSeleccionado))
    }
    return contarProgramasAgregado(payload.localidades)
  }, [payload, departamentoSeleccionado, localidadSeleccionada])

  const comparativasIndicadores: ComparativaPerCapita[] = useMemo(() => {
    if (localidadSeleccionada) {
      const atpMontoLocalidad = localidadSeleccionada.programas
        .filter((p) => p.programa === 'atp')
        .reduce((s, p) => s + (p.monto ?? 0), 0)
      const totalMontoLocalidad = (localidadSeleccionada.transferencias_total ?? 0) + atpMontoLocalidad
      const totalPerCapitaLocalidad =
        localidadSeleccionada.poblacion_2022 && totalMontoLocalidad > 0
          ? totalMontoLocalidad / localidadSeleccionada.poblacion_2022
          : null
      const secundarios = (depto: number | null, prov: number | null) => [
        { label: 'Depto', valor: depto },
        { label: 'Provincia', valor: prov },
      ]
      return [
        {
          label: 'Transferencias per cápita',
          valor: localidadSeleccionada.transferencias_per_capita,
          secundarios: secundarios(
            departamentoDeLocalidadSeleccionada?.transferencias_per_capita ?? null,
            kpisProvinciaCompleta.transferencias_per_capita,
          ),
        },
        {
          label: 'ATP per cápita',
          valor: localidadSeleccionada.atp_monto_per_capita,
          secundarios: secundarios(
            departamentoDeLocalidadSeleccionada?.atp_monto_per_capita ?? null,
            kpisProvinciaCompleta.atp_monto_per_capita,
          ),
        },
        {
          label: 'Total per cápita',
          valor: totalPerCapitaLocalidad,
          secundarios: secundarios(
            departamentoDeLocalidadSeleccionada?.total_monto_per_capita ?? null,
            kpisProvinciaCompleta.total_monto_per_capita,
          ),
        },
      ]
    }
    if (departamentoSeleccionado) {
      return [
        {
          label: 'Transferencias per cápita',
          valor: departamentoAgregadoActivo?.transferencias_per_capita ?? null,
          secundarios: [{ label: 'Provincia', valor: kpisProvinciaCompleta.transferencias_per_capita }],
        },
        {
          label: 'ATP per cápita',
          valor: departamentoAgregadoActivo?.atp_monto_per_capita ?? null,
          secundarios: [{ label: 'Provincia', valor: kpisProvinciaCompleta.atp_monto_per_capita }],
        },
        {
          label: 'Total per cápita',
          valor: departamentoAgregadoActivo?.total_monto_per_capita ?? null,
          secundarios: [{ label: 'Provincia', valor: kpisProvinciaCompleta.total_monto_per_capita }],
        },
      ]
    }
    // Provincia — no hay nada más amplio contra qué comparar.
    return [
      { label: 'Transferencias per cápita', valor: kpisProvinciaCompleta.transferencias_per_capita, secundarios: [] },
      { label: 'ATP per cápita', valor: kpisProvinciaCompleta.atp_monto_per_capita, secundarios: [] },
      { label: 'Total per cápita', valor: kpisProvinciaCompleta.total_monto_per_capita, secundarios: [] },
    ]
  }, [
    localidadSeleccionada,
    departamentoSeleccionado,
    departamentoDeLocalidadSeleccionada,
    departamentoAgregadoActivo,
    kpisProvinciaCompleta,
  ])

  const baseLocalidadesKpis = localidadesFiltradas ?? payload.localidades
  const deptosPresentesKpis = useMemo(
    () => new Set(baseLocalidadesKpis.map((l) => l.departamento).filter((d): d is string => !!d)),
    [baseLocalidadesKpis],
  )
  const payloadKpis = useMemo(
    () => ({
      ...payload,
      localidades: baseLocalidadesKpis,
      total_localidades_por_departamento: Object.fromEntries(
        Object.entries(payload.total_localidades_por_departamento).filter(([d]) => deptosPresentesKpis.has(d)),
      ),
    }),
    [payload, baseLocalidadesKpis, deptosPresentesKpis],
  )
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
  const focalizacionDeptos = deptos
    .filter((d) => d.focalizacion_atp !== null)
    .sort((a, b) => (a.focalizacion_atp ?? 0) - (b.focalizacion_atp ?? 0))

  // Con un departamento elegido, "por departamento" deja de tener sentido (ya
  // es uno solo) — pasa a mostrar la misma focalización pero entre las
  // localidades DE ese departamento (pedido explícito 2026-10-01).
  const focalizacionLocalidades = useMemo(
    () => (departamentoSeleccionado ? calcularFocalizacionPorLocalidad(payload, departamentoSeleccionado) : []),
    [payload, departamentoSeleccionado],
  )
  const focalizacionLocalidadesConDato = focalizacionLocalidades
    .filter((l) => l.focalizacion_atp !== null)
    .sort((a, b) => (a.focalizacion_atp ?? 0) - (b.focalizacion_atp ?? 0))

  const focalizacion = departamentoSeleccionado ? focalizacionLocalidadesConDato : focalizacionDeptos
  const focalizacionLabels = departamentoSeleccionado
    ? focalizacionLocalidadesConDato.map((l) => l.localidad)
    : focalizacionDeptos.map((d) => d.departamento)

  // Vista "nominal" del mismo gráfico (pedido 2026-10-01): monto ATP en
  // millones de $ en vez del índice %/% de focalización, con una barra de
  // referencia de promedio al final (provincial a nivel departamento,
  // departamental a nivel localidad — mismo criterio contextual que ya usa
  // el resto de este componente al elegir un departamento).
  const ATP_MILLON = 1_000_000
  const nominalDeptos = deptos.filter((d) => d.atp_monto > 0).sort((a, b) => b.atp_monto - a.atp_monto)
  const promedioAtpProvincial = deptos.length
    ? deptos.reduce((s, d) => s + d.atp_monto, 0) / deptos.length
    : 0
  const nominalLocalidades = [...focalizacionLocalidades]
    .filter((l) => l.atp_monto > 0)
    .sort((a, b) => b.atp_monto - a.atp_monto)
  const promedioAtpDepartamental = focalizacionLocalidades.length
    ? focalizacionLocalidades.reduce((s, l) => s + l.atp_monto, 0) / focalizacionLocalidades.length
    : 0

  const nominalItems = departamentoSeleccionado ? nominalLocalidades : nominalDeptos
  const nominalPromedio = departamentoSeleccionado ? promedioAtpDepartamental : promedioAtpProvincial
  const nominalPromedioLabel = departamentoSeleccionado ? 'Promedio departamental' : 'Promedio provincial'
  const nominalLabels = [
    ...(departamentoSeleccionado ? nominalLocalidades.map((l) => l.localidad) : nominalDeptos.map((d) => d.departamento)),
    nominalPromedioLabel,
  ]
  const nominalValues = [...nominalItems.map((d) => d.atp_monto / ATP_MILLON), nominalPromedio / ATP_MILLON]
  const nominalColors = [...nominalItems.map(() => '#01aae3'), '#172c3f']

  return (
    <div className="space-y-4">
      <IndicadoresPrincipales
        titulo={tituloIndicadores}
        conteos={conteosIndicadores}
        comparativas={comparativasIndicadores}
      />

      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {departamentoSeleccionado ? `Indicadores — ${departamentoSeleccionado}` : 'Indicadores — toda la provincia'}
        </p>
        <KpiStrip items={kpiItems} />
      </div>

      {kpisTabla && kpisTabla.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Resumen de la tabla general
          </p>
          <KpiStrip items={kpisTabla} />
        </div>
      )}

      {/* Explicaciones de los indicadores del segundo nivel (Población/
          Cobertura/Transferencias/etc.) — al final de todos los indicadores
          (pedido 2026-10-01), no pegadas al KpiStrip que describen. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        {kpiGlosario.map((k) => (
          <li key={k.label}>
            <span className="font-semibold text-gray-500">{k.label}:</span> {k.explicacion}
          </li>
        ))}
      </ul>

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

      {(nominalItems.length > 0 || focalizacion.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gov-navy">
              {vistaAtp === 'nominal'
                ? departamentoSeleccionado
                  ? `ATP — montos por localidad (millones de $) — ${departamentoSeleccionado}`
                  : 'ATP — montos por departamento (millones de $)'
                : departamentoSeleccionado
                  ? `Focalización ATP por localidad — ${departamentoSeleccionado}`
                  : 'Focalización ATP por departamento'}
            </p>
            <div className="inline-flex bg-slate-100 border border-slate-300 rounded-lg p-0.5">
              {(
                [
                  { id: 'nominal', label: 'Montos ($)' },
                  { id: 'focalizacion', label: 'Focalización (%/%)' },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVistaAtp(v.id)}
                  className={`px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap ${
                    vistaAtp === v.id ? 'bg-gov-cyan text-white' : 'text-gray-600'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {vistaAtp === 'nominal' ? (
            <>
              <p className="text-[11px] text-gray-400 mb-3">
                Monto total comprometido en ATP, en millones de pesos · "{nominalPromedioLabel}" es el promedio
                {departamentoSeleccionado ? ' entre las localidades de este departamento' : ' entre los 26 departamentos'}.
              </p>
              <BarChart
                labels={nominalLabels}
                values={nominalValues.map((v) => Math.round(v * 10) / 10)}
                colors={nominalColors}
                horizontal
                tooltipSuffix=" M"
                height={Math.max(220, nominalLabels.length * 26)}
              />
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 mb-3">
                &gt; 1.00: {departamentoSeleccionado ? 'la localidad recibió' : 'el departamento recibió'} más ATP del que
                le tocaría por población · &lt; 1.00: menos.
              </p>
              <BarChart
                labels={focalizacionLabels}
                values={focalizacion.map((d) => d.focalizacion_atp ?? 0)}
                colors={focalizacion.map((d) => colorDivergente(d.focalizacion_atp ?? 1, 1))}
                horizontal
                height={Math.max(220, focalizacion.length * 26)}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
