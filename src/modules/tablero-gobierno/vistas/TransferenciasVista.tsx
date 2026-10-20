import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type Pago, type Transferencias } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SerieComparada, Tabla, Velocimetro, type Columna } from '../components/Bloques'
import { MESES, fmtFecha, fmtMonto, fmtN, fmtPct, fmtPeriodo, fmtVariacion } from '../formato'
import type { ContextoTablero } from './contexto'

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const COLOR_ANIO = ['#9db0c1', '#01aae3', '#398ebd', '#172c3f']
const SERIES_RETENCION = [
  { nombre: 'Caja / COPA bruta', color: '#398ebd' },
  { nombre: 'APROSS / COPA bruta', color: '#2e8b57' },
]

const COLUMNAS_PAGOS: Columna<Pago>[] = [
  { titulo: 'Mes', valor: (p) => p.mes, render: (p) => MESES_LARGOS[p.mes - 1] },
  { titulo: 'Quincena', valor: (p) => p.quincena, render: (p) => (p.quincena ? `${p.quincena}ª` : '—') },
  { titulo: 'Fecha de pago', valor: (p) => p.fecha_pago, render: (p) => fmtFecha(p.fecha_pago) },
  { titulo: 'Bruto', valor: (p) => p.bruto, render: (p) => fmtMonto(p.bruto), numerica: true },
  { titulo: 'Neto transferido', valor: (p) => p.neto, render: (p) => fmtMonto(p.neto), numerica: true },
  { titulo: '% neto', valor: (p) => (p.bruto ? p.neto / p.bruto : null), render: (p) => fmtPct(p.bruto ? p.neto / p.bruto : null), numerica: true },
]

const pagoTexto = (p: Pago | null) =>
  p ? `${p.quincena ? `${p.quincena}ª quincena de ` : ''}${MESES_LARGOS[p.mes - 1]}` : '—'

/** Coparticipación y FOFINDES. Desde la planilla de Gobierno cuando tiene el año (Etapa 2:
 * neto, quincenas, descuentos, retenciones, % a sueldos); si no, los montos brutos que publica
 * Transparencia (Etapa 1). spec-datos-externos-fase2-transferencias.md §5. */
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
  const planilla = d.fuente === 'planilla'
  const hasta = fmtPeriodo(d.ultimo_periodo)

  const comparativa = (
    <Kpi
      label={`vs. ${d.anio - 1}, mismo período`}
      valor={<span className={d.variacion == null ? '' : d.variacion >= 0 ? 'text-emerald-700' : 'text-red-700'}>{fmtVariacion(d.variacion)}</span>}
      detalle={d.acumulado_anterior != null ? `${d.anio - 1}: ${fmtMonto(d.acumulado_anterior)}` : undefined}
    />
  )

  return (
    <div className="space-y-4">
      {planilla ? (
        <Kpis>
          <Kpi
            label={`${d.etiqueta} ${d.anio}`}
            valor={fmtMonto(d.total_anio)}
            detalle={`neto transferido ${fmtMonto(d.total_neto_anio)} · enero a ${hasta}`}
          />
          <Kpi
            label="Último pago"
            valor={<span className="text-lg">{pagoTexto(d.ultimo_pago)}</span>}
            detalle={d.ultimo_pago ? `pagado el ${fmtFecha(d.ultimo_pago.fecha_pago)} · ${fmtMonto(d.ultimo_pago.bruto)}` : undefined}
          />
          <Kpi
            label="Último mes completo"
            valor={<span className="text-lg">{d.ultimo_mes_completo ? MESES_LARGOS[d.ultimo_mes_completo.mes - 1] : '—'}</span>}
            detalle={d.ultimo_mes_completo ? `bruto ${fmtMonto(d.ultimo_mes_completo.bruto)} · neto ${fmtMonto(d.ultimo_mes_completo.neto)}` : undefined}
          />
          {comparativa}
          <Kpi label="Localidades" valor={fmtN(d.localidades)} detalle={`con ${d.etiqueta} en ${d.anio}`} />
        </Kpis>
      ) : (
        <Kpis>
          <Kpi label={`${d.etiqueta} ${d.anio}`} valor={fmtMonto(d.total_anio)} detalle={d.ultimo_periodo ? `enero a ${hasta}` : 'sin datos publicados en el año'} />
          <Kpi label="Último mes publicado" valor={hasta} detalle={fmtMonto(d.ultimo_mes)} />
          {comparativa}
          <Kpi label="Localidades con transferencias" valor={fmtN(d.localidades)} detalle={`en ${d.anio}`} />
        </Kpis>
      )}

      {planilla && d.pct_sueldos && <Sueldos d={d} />}

      <div className={`grid gap-4 ${planilla && d.descuentos.length ? 'lg:grid-cols-2' : ''}`}>
        <Panel
          titulo="Mes a mes"
          ayuda={`${d.etiqueta} bruta: ${d.anio} contra ${d.anio - 1}${d.fuente_anterior !== d.fuente ? ` (${d.anio - 1} desde Transparencia)` : ''}.`}
        >
          <SerieComparada labels={MESES} series={series} formato={fmtMonto} />
        </Panel>
        {planilla && d.descuentos.length > 0 && <Descuentos d={d} />}
      </div>

      {planilla && d.mensual_neto && seccion === 'fofindes' && (
        <Panel titulo="Bruto y neto transferido por mes" ayuda={`${d.anio}. La diferencia son los descuentos.`}>
          <SerieComparada
            labels={MESES}
            series={[
              { nombre: 'Bruto', valores: d.mensual, color: '#398ebd' },
              { nombre: 'Neto transferido', valores: d.mensual_neto, color: '#01aae3' },
            ]}
            formato={fmtMonto}
          />
        </Panel>
      )}

      {planilla && d.retenciones && d.retenciones.mensual.length > 0 && <RetencionesPanel d={d} />}

      {planilla && d.pagos.length > 0 && (
        <Panel titulo={seccion === 'coparticipacion' ? 'Pagos por quincena' : 'Pagos'} ayuda={`${d.anio}, sumados sobre el filtro.`}>
          <Tabla
            columnas={COLUMNAS_PAGOS}
            filas={[...d.pagos].reverse()}
            archivo={`${seccion}_pagos_${d.anio}.xlsx`}
            total={['Total', '', '', fmtMonto(d.total_anio), fmtMonto(d.total_neto_anio), fmtPct(d.total_anio ? (d.total_neto_anio ?? 0) / d.total_anio : null)]}
          />
        </Panel>
      )}

      {seccion === 'coparticipacion' && d.por_concepto.length > 0 && (
        <Panel titulo={`Transferencias automáticas por concepto en ${d.anio}`} ayuda="Todo lo que publica Transparencia para el mismo filtro (control).">
          <BarChart
            labels={d.por_concepto.map((c) => c.etiqueta)}
            values={d.por_concepto.map((c) => c.monto / 1e6)}
            horizontal
            height={Math.max(160, d.por_concepto.length * 42)}
            tooltipSuffix=" M"
          />
        </Panel>
      )}

      {planilla ? (
        <Fuente>
          planilla "11.1 {seccion === 'coparticipacion' ? 'COPARTICIPACION' : 'FOFINDES'}" de Gobierno (sincronizada a diario). Transparencia
          (PDF mensual) queda como control.
        </Fuente>
      ) : (
        <>
          <Aviso tono="warn">
            La planilla de Gobierno no tiene datos de {d.anio}: se muestran los montos brutos que publica Transparencia, sin neto, quincenas ni
            retenciones.
          </Aviso>
          <Fuente>Transferencias automáticas a municipios y comunas — transparencia.cba.gov.ar (PDF mensual).</Fuente>
        </>
      )}
    </div>
  )
}

function Sueldos({ d }: { d: Transferencias }) {
  const s = d.pct_sueldos!
  return (
    <Panel
      titulo="Coparticipación + FOFINDES que se destina a sueldos"
      ayuda={
        s.anio_masa == null
          ? 'Ninguna localidad del filtro tiene masa salarial cargada.'
          : `Masa salarial ${s.anio_masa} sobre lo de ${fmtPeriodo(s.mes_referencia)} (último mes completo). ${fmtN(s.localidades_con_dato)} de ${fmtN(s.localidades)} localidades con dato; el cálculo usa solo esas. Sobre lo neto puede pasar el 100 %.`
      }
    >
      <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
        <Velocimetro valor={s.bruto} etiqueta="sobre el total que corresponde" />
        <Velocimetro valor={s.neto} etiqueta="sobre lo neto transferido" color="#e07b39" />
      </div>
      {!s.incluye_fofindes && <p className="text-xs text-amber-700 mt-2">FOFINDES todavía no tiene ese mes: el porcentaje usa solo la coparticipación.</p>}
    </Panel>
  )
}

function Descuentos({ d }: { d: Transferencias }) {
  const TOP = 8
  const top = d.descuentos.slice(0, TOP)
  const resto = d.descuentos.slice(TOP).reduce((a, c) => a + c.monto, 0)
  const items = resto > 0 ? [...top, { concepto: 'otros', etiqueta: `Otros (${d.descuentos.length - TOP})`, monto: resto }] : top
  return (
    <Panel titulo={`Descuentos en ${d.anio}`} ayuda="Bruto → neto: los conceptos que más descuentan, en millones.">
      <BarChart
        labels={items.map((c) => c.etiqueta)}
        values={items.map((c) => c.monto / 1e6)}
        color="#e07b39"
        horizontal
        height={Math.max(180, items.length * 30)}
        tooltipSuffix=" M"
      />
    </Panel>
  )
}

function RetencionesPanel({ d }: { d: Transferencias }) {
  const ret = d.retenciones!
  const [mes, setMes] = useState<number>((ret.mes_referencia ?? 1) - 1)
  const anios = ret.mensual
  const porMes = useMemo(
    () => anios.map((r, i) => ({ nombre: String(r.anio), valores: r.caja, color: COLOR_ANIO[Math.max(0, COLOR_ANIO.length - anios.length + i)] })),
    [anios],
  )
  const labels = anios.map((r) => String(r.anio))
  const acumulado = useMemo(
    () => [
      { ...SERIES_RETENCION[0], valores: anios.map((r) => r.acumulado_caja[mes]) },
      { ...SERIES_RETENCION[1], valores: anios.map((r) => r.acumulado_apross[mes]) },
    ],
    [anios, mes],
  )
  const mismoMes = useMemo(
    () => [
      { ...SERIES_RETENCION[0], valores: anios.map((r) => r.caja[mes]) },
      { ...SERIES_RETENCION[1], valores: anios.map((r) => r.apross[mes]) },
    ],
    [anios, mes],
  )
  return (
    <Panel
      titulo="Retenciones sobre la coparticipación bruta"
      ayuda="Caja de Jubilaciones y APROSS como % de la COPA bruta (las comparativas del Looker). El mes elige el corte de las dos comparativas de abajo."
      extra={
        <label className="text-xs text-gray-600 flex items-center gap-1.5">
          Mes
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="border border-slate-300 rounded px-1.5 py-1 text-xs" aria-label="Mes de la comparativa">
            {MESES_LARGOS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </label>
      }
    >
      <h4 className="text-xs font-semibold text-gov-navy mb-1">Caja / COPA bruta, mes a mes</h4>
      <SerieComparada labels={MESES} series={porMes} formato={fmtPct} height={230} ariaLabel="Caja sobre COPA bruta, mes a mes por año" />
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-gov-navy mb-1">Acumulado a {MESES_LARGOS[mes]} de cada año</h4>
          <SerieComparada labels={labels} series={acumulado} formato={fmtPct} horizontal height={60 + labels.length * 44} ariaLabel="Retenciones acumuladas por año" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-gov-navy mb-1">Mes de {MESES_LARGOS[mes]} de cada año</h4>
          <SerieComparada labels={labels} series={mismoMes} formato={fmtPct} horizontal height={60 + labels.length * 44} ariaLabel="Retenciones del mismo mes por año" />
        </div>
      </div>
    </Panel>
  )
}
