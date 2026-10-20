import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SerieComparada } from '../components/Bloques'
import { MESES, fmtMonto, fmtN, fmtPeriodo, fmtVariacion } from '../formato'
import type { ContextoTablero } from './contexto'

/** Coparticipación y FOFINDES (Etapa 1): montos brutos mensuales publicados en Transparencia.
 * Neto transferido, quincenas, retenciones (Caja y APROSS) y % a sueldos llegan en la Etapa 2,
 * con la planilla de Gobierno. */
export function TransferenciasVista({ ctx, seccion }: { ctx: ContextoTablero; seccion: 'coparticipacion' | 'fofindes' }) {
  const q = useQuery({
    queryKey: ['tablero-gobierno', 'transferencias', seccion, ctx.anio, ctx.codigos],
    queryFn: () => tableroApi.transferencias(seccion, ctx.anio, ctx.codigos),
  })
  const series = useMemo(
    () =>
      q.data
        ? [
            { nombre: String(ctx.anio - 1), valores: q.data.mensual_anterior, color: '#9db0c1' },
            { nombre: String(ctx.anio), valores: q.data.mensual, color: '#398ebd' },
          ]
        : [],
    [q.data, ctx.anio],
  )

  if (q.isError) return <Aviso tono="error">No pudimos cargar estas transferencias. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const hasta = fmtPeriodo(d.ultimo_periodo)

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label={`${d.etiqueta} ${d.anio}`} valor={fmtMonto(d.total_anio)} detalle={d.ultimo_periodo ? `enero a ${hasta}` : 'sin datos publicados en el año'} />
        <Kpi label="Último mes publicado" valor={hasta} detalle={fmtMonto(d.ultimo_mes)} />
        <Kpi
          label={`vs. ${d.anio - 1}, mismo período`}
          valor={<span className={d.variacion == null ? '' : d.variacion >= 0 ? 'text-emerald-700' : 'text-red-700'}>{fmtVariacion(d.variacion)}</span>}
          detalle={d.acumulado_anterior != null ? `${d.anio - 1}: ${fmtMonto(d.acumulado_anterior)}` : undefined}
        />
        <Kpi label="Localidades con transferencias" valor={fmtN(d.localidades)} detalle={`en ${d.anio}`} />
      </Kpis>

      <Panel titulo="Mes a mes" ayuda={`${d.etiqueta}: ${d.anio} contra ${d.anio - 1}, montos brutos.`}>
        <SerieComparada labels={MESES} series={series} formato={fmtMonto} />
      </Panel>

      {seccion === 'coparticipacion' && d.por_concepto.length > 0 && (
        <Panel titulo={`Transferencias automáticas por concepto en ${d.anio}`} ayuda="Todo lo que publica Transparencia para el mismo filtro.">
          <BarChart
            labels={d.por_concepto.map((c) => c.etiqueta)}
            values={d.por_concepto.map((c) => c.monto / 1e6)}
            horizontal
            height={Math.max(160, d.por_concepto.length * 42)}
            tooltipSuffix=" M"
          />
        </Panel>
      )}

      <Aviso tono="warn">
        Por ahora son los montos brutos que publica Transparencia. El neto transferido, las quincenas, las retenciones (Caja y APROSS) y el % que va a sueldos se suman en la Etapa 2, con la planilla de Gobierno.
      </Aviso>
      <Fuente>Transferencias automáticas a municipios y comunas — transparencia.cba.gov.ar (PDF mensual).</Fuente>
    </div>
  )
}
