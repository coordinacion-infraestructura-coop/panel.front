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
import {
  calcularCoberturaPorUmbral,
  calcularDepartamentos,
  calcularFocalizacionPorLocalidad,
  calcularKpisProvincia,
  type KpisProvincia,
} from '../utils/departamentoAgregados'
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
      '% de localidades del departamento que alcanzan el mínimo de gestiones elegido en el control de abajo (default 3), sumando las 5 fuentes (Vivienda, Privada, ATP, Gas), sobre el total de localidades del padrón geográfico.',
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
  kpisFiltrados,
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
  /** `calcularKpisProvincia` ya acotado por `localidadesFiltradas` (búsqueda +
   * depto + localidad + área/programa/estado/checklist/visita) — calculado en
   * el padre (`ResumenTerritorialPage`) porque "Cobertura territorial" se
   * mudó a `kpisTabla` (2026-10-01) y necesita el mismo valor; acá sólo queda
   * `poblacion_2022` del segundo nivel de indicadores. Antes se calculaba
   * acá mismo recibiendo `localidadesFiltradas` — bug real reportado
   * 2026-10-01: elegir una localidad no cambiaba los indicadores nuevos,
   * corregido escalando por el filtro activo (ahora resuelto en el padre). */
  kpisFiltrados: KpisProvincia
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
  // Umbral mínimo de líneas de programa/gestión para que una localidad
  // cuente como "cubierta" en el mapa de Cobertura (pedido 2026-10-01, mismo
  // control deslizante que la "Curva de cobertura por umbral" del informe
  // general de proyecto_sistema_gestiones) — sólo se muestra con esa métrica
  // elegida.
  const [umbralCobertura, setUmbralCobertura] = useState(3)

  // El mapa es comparativo — siempre muestra los 26 departamentos entre sí,
  // elegir uno no lo recorta (perdería el punto de comparación). Los KPIs de
  // cabecera sí recalculan para la selección actual (ver `localidadesFiltradas`
  // arriba).
  const deptos = useMemo(() => calcularDepartamentos(payload), [payload])
  const coberturaUmbral = useMemo(
    () => calcularCoberturaPorUmbral(payload, umbralCobertura),
    [payload, umbralCobertura],
  )

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

  // Transferencias totales de la escala activa, para la tarjeta de
  // Indicadores Principales (se mudó acá desde el panel de "Indicadores" de
  // abajo, 2026-10-01) — mismo criterio de escala que `comparativasIndicadores`.
  const transferenciasTotalActivo = localidadSeleccionada
    ? { valor: localidadSeleccionada.transferencias_total, periodo: localidadSeleccionada.transferencias_periodo }
    : departamentoSeleccionado
      ? { valor: departamentoAgregadoActivo?.transferencias_total ?? null, periodo: kpisProvinciaCompleta.transferencias_periodo }
      : { valor: kpisProvinciaCompleta.transferencias_total, periodo: kpisProvinciaCompleta.transferencias_periodo }

  const mapData: DatoMapa[] = useMemo(
    () =>
      deptos.map((d) => {
        // Cobertura con umbral (pedido 2026-10-01): reemplaza el criterio fijo
        // "≥1 registro" de `calcularDepartamentos` por el umbral ajustable del
        // slider — sólo afecta estos 2 campos, que son los únicos que lee el
        // tooltip de la métrica "pct_cobertura".
        const cu = coberturaUmbral[d.departamento]
        return {
          departamento: d.departamento,
          // shape legado (tooltip de cantidad/pct_cobertura reusa estos campos)
          cantidad: d.total_programas,
          localidades_cubiertas: cu?.localidades_con_umbral ?? d.localidades_con_datos,
          localidades_totales: cu?.localidades_totales ?? d.localidades_totales,
          // métricas nuevas de Etapa 3
          promedio_programas: d.promedio_programas,
          gestiones_10k_hab: d.gestiones_10k_hab,
          pct_cobertura: cu?.pct_cobertura ?? d.pct_cobertura,
          focalizacion_atp: d.focalizacion_atp,
        }
      }),
    [deptos, coberturaUmbral],
  )

  const metricaInfo = METRICAS.find((m) => m.id === metrica)!

  const kpiItems: Kpi[] = [
    { value: fmtInt(kpisFiltrados.poblacion_2022), label: 'Población (Censo 2022)', accent: 'navy' },
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
  // millones de $ en vez del índice %/% de focalización, con una LÍNEA
  // vertical punteada de referencia (provincial a nivel departamento,
  // departamental a nivel localidad — mismo criterio contextual que ya usa
  // el resto de este componente al elegir un departamento). Antes era una
  // barra más al final del gráfico — pedido 2026-10-01: pasa a línea para
  // no competir visualmente como si fuera "un departamento/localidad más".
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
  const nominalLabels = departamentoSeleccionado
    ? nominalLocalidades.map((l) => l.localidad)
    : nominalDeptos.map((d) => d.departamento)
  const nominalValues = nominalItems.map((d) => Math.round((d.atp_monto / ATP_MILLON) * 10) / 10)
  const nominalColors = nominalItems.map(() => '#01aae3')

  return (
    <div className="space-y-4">
      <IndicadoresPrincipales
        titulo={tituloIndicadores}
        conteos={conteosIndicadores}
        comparativas={comparativasIndicadores}
        transferenciasTotal={transferenciasTotalActivo}
      />

      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {departamentoSeleccionado ? `Indicadores Demográficos — ${departamentoSeleccionado}` : 'Indicadores Demográficos — toda la provincia'}
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
        {metrica === 'pct_cobertura' && (
          <div className="flex items-end gap-3 flex-wrap mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex-1 min-w-[220px]">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                Mínimo de gestiones por localidad
                <span className="text-sm font-extrabold text-gov-cyan">{umbralCobertura}</span>
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={umbralCobertura}
                onChange={(e) => setUmbralCobertura(Number(e.target.value))}
                className="w-full accent-gov-cyan cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 max-w-xs">
              Una localidad cuenta como "cubierta" si tiene al menos esta cantidad de líneas de
              programa/gestión registradas (sumando las 5 fuentes). Default: 3.
            </p>
          </div>
        )}
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
                Monto total comprometido en ATP, en millones de pesos · la línea punteada marca "
                {nominalPromedioLabel}"
                {departamentoSeleccionado ? ' (promedio entre las localidades de este departamento)' : ' (promedio entre los 26 departamentos)'}.
              </p>
              <BarChart
                labels={nominalLabels}
                values={nominalValues}
                colors={nominalColors}
                horizontal
                tooltipSuffix=" M"
                lineaReferencia={{ valor: Math.round((nominalPromedio / ATP_MILLON) * 10) / 10 }}
                height={Math.max(220, nominalLabels.length * 26)}
              />
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 mb-3">
                &gt; 1.00: {departamentoSeleccionado ? 'la localidad recibió' : 'el departamento recibió'} más ATP del que
                le tocaría por población · &lt; 1.00: menos · la línea punteada marca el total provincial (1.00,
                proporcional).
              </p>
              <BarChart
                labels={focalizacionLabels}
                values={focalizacion.map((d) => d.focalizacion_atp ?? 0)}
                colors={focalizacion.map((d) => colorDivergente(d.focalizacion_atp ?? 1, 1))}
                horizontal
                lineaReferencia={{ valor: 1 }}
                height={Math.max(220, focalizacion.length * 26)}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
