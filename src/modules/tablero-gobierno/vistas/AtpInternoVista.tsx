import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type AtpHistorico, type AtpInterno, type AtpInternoPago, type AtpInternoPeriodo } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, type Columna } from '../components/Bloques'
import { MESES, fmtFecha, fmtMonto, fmtN } from '../formato'
import type { ContextoTablero } from './contexto'

type FilaLocalidad = AtpInternoPeriodo['por_localidad'][number]

const COL_PAGOS: Columna<AtpInternoPago>[] = [
  { titulo: 'Fecha', valor: (f) => f.fecha, render: (f) => (f.fecha ? fmtFecha(f.fecha) : <span className="text-amber-700">Fecha mal cargada</span>) },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Monto', valor: (f) => f.monto, render: (f) => fmtMonto(f.monto), numerica: true },
]

const COL_LOCALIDADES: Columna<FilaLocalidad>[] = [
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Pagos', valor: (f) => f.pagos, numerica: true },
  { titulo: 'Monto', valor: (f) => f.monto, render: (f) => fmtMonto(f.monto), numerica: true },
  { titulo: 'Último pago', valor: (f) => f.ultimo_pago, render: (f) => fmtFecha(f.ultimo_pago) },
]

/** Une dos períodos sin años en común: localidades por código, departamentos recalculados. */
function unirPeriodos(a: AtpInternoPeriodo, b: AtpInternoPeriodo): AtpInternoPeriodo {
  const locs = new Map<string, FilaLocalidad>()
  for (const l of [...a.por_localidad, ...b.por_localidad]) {
    const prev = locs.get(l.codigo_indec)
    locs.set(
      l.codigo_indec,
      prev
        ? {
            ...prev,
            pagos: prev.pagos + l.pagos,
            monto: prev.monto + l.monto,
            ultimo_pago: !prev.ultimo_pago || (l.ultimo_pago && l.ultimo_pago > prev.ultimo_pago) ? l.ultimo_pago : prev.ultimo_pago,
          }
        : { ...l },
    )
  }
  const porLocalidad = [...locs.values()].sort((x, y) => y.monto - x.monto)
  const deptos = new Map<string, { departamento: string; localidades: number; pagos: number; monto: number }>()
  for (const l of porLocalidad) {
    const clave = l.departamento ?? 'Sin dato'
    const d = deptos.get(clave) ?? { departamento: clave, localidades: 0, pagos: 0, monto: 0 }
    deptos.set(clave, { ...d, localidades: d.localidades + 1, pagos: d.pagos + l.pagos, monto: d.monto + l.monto })
  }
  return {
    kpis: {
      localidades: porLocalidad.length,
      pagos: a.kpis.pagos + b.kpis.pagos,
      monto: a.kpis.monto + b.kpis.monto,
      sin_fecha: a.kpis.sin_fecha + b.kpis.sin_fecha,
      monto_sin_fecha: a.kpis.monto_sin_fecha + b.kpis.monto_sin_fecha,
    },
    mensual: [],
    por_departamento: [...deptos.values()].sort((x, y) => y.monto - x.monto),
    por_localidad: porLocalidad,
  }
}

/** ATP Interno (2026) más el histórico 2023–2025 de la Privada: los años no se superponen
 * (spec-datos-externos-privada-gobernador.md §7.4). */
function unir(interno: AtpInterno, historico: AtpHistorico | undefined): AtpInterno {
  if (!historico?.gestion) return interno
  const gestion = interno.gestion ? unirPeriodos(interno.gestion, historico.gestion) : historico.gestion
  return {
    ...interno,
    anios: [...new Set([...historico.anios, ...interno.anios])].sort((x, y) => x - y),
    gestion,
    por_anio: [...historico.por_anio, ...interno.por_anio].sort((x, y) => x.anio - y.anio),
    pagos: [...interno.pagos, ...historico.pagos],
  }
}

/** ATP Interno de Gobierno (Etapa 4, spec-atp-interno.md §6), con el histórico 2023–2025 de la
 * planilla de la Privada. Solo Admin y Autoridad; ninguna respuesta trae el referente. Nunca se
 * suma con ATP Compromisos (ADR-029). */
export function AtpInternoVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'atp-interno', ctx.codigos], queryFn: () => tableroApi.atpInterno(ctx.codigos) })
  const qh = useQuery({ queryKey: ['tablero-gobierno', 'atp-historico', ctx.codigos], queryFn: () => tableroApi.atpHistorico(ctx.anio, ctx.codigos) })
  const datos = useMemo(() => (q.data ? unir(q.data, qh.data) : undefined), [q.data, qh.data])
  const pagos = useMemo(() => (!datos ? [] : anio === 'gestion' ? datos.pagos : datos.pagos.filter((p) => p.anio === anio)), [datos, anio])

  if (q.isError) return <Aviso tono="error">No pudimos cargar el ATP Interno. Probá de nuevo en un rato.</Aviso>
  if (!datos || qh.isLoading) return <Cargando />
  const d = datos
  const corte = qh.data?.corte ? Number(qh.data.corte.slice(0, 4)) : 2026
  const avisoSync =
    d.estado_sincronizacion === 'error' ? (
      <Aviso tono="warn">La última sincronización de la planilla falló; se muestran los datos de la carga anterior.</Aviso>
    ) : d.estado_sincronizacion === 'frenado' ? (
      <Aviso tono="warn">La última lectura de la planilla vino casi vacía y no se aplicó; se muestran los datos de la carga anterior.</Aviso>
    ) : null
  const avisoHistorico = qh.isError ? (
    <Aviso tono="warn">No pudimos cargar el histórico 2023–2025: se muestra solo lo de ATP Interno.</Aviso>
  ) : qh.data?.estado_sincronizacion === 'fallido' ? (
    <Aviso tono="warn">La última lectura del histórico 2023–2025 falló; se muestran los datos de la carga anterior.</Aviso>
  ) : null
  if (!d.gestion) {
    return (
      <div className="space-y-4">
        {avisoSync}
        <Aviso tono="warn">{ctx.codigos ? 'No hay pagos de ATP Interno para este filtro.' : 'Todavía no hay datos sincronizados de la planilla de ATP Interno.'}</Aviso>
      </div>
    )
  }
  const p = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.periodo ?? d.gestion
  const k = p.kpis
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const deptos = p.por_departamento.slice(0, 15)

  return (
    <div className="space-y-4">
      {avisoSync}
      {avisoHistorico}
      <Panel titulo="Año" ayuda={`Filtro propio de esta página: por defecto muestra toda la gestión. Hasta ${corte - 1} los datos son del histórico de la Privada; desde ${corte}, de ATP Interno.`}>
        <SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de ATP Interno" />
      </Panel>

      <Kpis>
        <Kpi label="Localidades con ATP" valor={fmtN(k.localidades)} detalle={periodo} />
        <Kpi label="Pagos" valor={fmtN(k.pagos)} />
        <Kpi label="Monto pagado" valor={fmtMonto(k.monto)} />
        <Kpi label="Saldo disponible" valor={d.saldo_disponible == null ? 'Sin fuente' : fmtMonto(d.saldo_disponible)} detalle="preguntado al área" />
      </Kpis>

      {k.sin_fecha > 0 && (
        <Aviso>
          {fmtN(k.sin_fecha)} pagos ({fmtMonto(k.monto_sin_fecha)}) tienen la fecha mal cargada en la planilla: se cuentan en el año de la planilla y no
          aparecen en el gráfico por mes.
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel titulo={anio === 'gestion' ? 'Pagos por año' : `Pagos por mes de ${anio}`} ayuda="Monto pagado, en millones.">
          {anio === 'gestion' ? (
            <BarChart labels={d.por_anio.map((a) => String(a.anio))} values={d.por_anio.map((a) => a.periodo.kpis.monto / 1e6)} height={220} tooltipSuffix=" M" />
          ) : (
            <BarChart labels={MESES} values={p.mensual.map((v) => v / 1e6)} height={220} tooltipSuffix=" M" />
          )}
        </Panel>
        <Panel titulo="Por departamento" ayuda="Monto pagado, en millones (los 15 mayores).">
          <BarChart
            labels={deptos.map((x) => x.departamento)}
            values={deptos.map((x) => x.monto / 1e6)}
            horizontal
            height={Math.max(180, deptos.length * 26)}
            tooltipSuffix=" M"
          />
        </Panel>
      </div>

      <Panel titulo="Por localidad" ayuda={`Pagos y monto ${periodo}.`}>
        <Tabla
          columnas={COL_LOCALIDADES}
          filas={p.por_localidad}
          archivo="atp_interno_localidades.xlsx"
          total={['Total', '', fmtN(k.pagos), fmtMonto(k.monto), '']}
        />
      </Panel>

      <Panel titulo="Pagos" ayuda={`Pagos ${periodo}, del más reciente al más viejo.`}>
        <Tabla columnas={COL_PAGOS} filas={pagos} archivo="atp_interno_pagos.xlsx" total={['Total', '', '', fmtMonto(k.monto)]} />
      </Panel>

      <Aviso>
        No se suma con ATP Compromisos: el área informó que los compromisos del Gobernador también se cargan en esta planilla y todavía no hay forma de
        identificarlos.
      </Aviso>
      <Fuente>
        {corte} en adelante: planilla "4. ATP 2026" de Gobierno, pestaña ATP ACUMULADO (sincronizada cada hora). Hasta {corte - 1}: planilla
        "Gobierno" de la Privada del Gobernador, pestaña ATP (sincronizada a diario).
      </Fuente>
    </div>
  )
}
