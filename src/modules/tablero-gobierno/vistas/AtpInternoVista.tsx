import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type AtpInternoPago, type AtpInternoPeriodo } from '../api/tablero.api'
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

/** ATP Interno de Gobierno (Etapa 4, spec-atp-interno.md §6). Solo Admin y Autoridad; la
 * respuesta no trae el referente. Nunca se suma con ATP Compromisos (ADR-029). */
export function AtpInternoVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'atp-interno', ctx.codigos], queryFn: () => tableroApi.atpInterno(ctx.codigos) })
  const pagos = useMemo(() => (!q.data ? [] : anio === 'gestion' ? q.data.pagos : q.data.pagos.filter((p) => p.anio === anio)), [q.data, anio])

  if (q.isError) return <Aviso tono="error">No pudimos cargar el ATP Interno. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const avisoSync =
    d.estado_sincronizacion === 'error' ? (
      <Aviso tono="warn">La última sincronización de la planilla falló; se muestran los datos de la carga anterior.</Aviso>
    ) : d.estado_sincronizacion === 'frenado' ? (
      <Aviso tono="warn">La última lectura de la planilla vino casi vacía y no se aplicó; se muestran los datos de la carga anterior.</Aviso>
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
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión. Hoy la planilla solo tiene 2026.">
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
        identificarlos. El histórico 2023–2025 que muestra el Looker no está disponible (se pidió al área).
      </Aviso>
      <Fuente>planilla "4. ATP 2026" de Gobierno, pestaña ATP ACUMULADO (sincronizada cada hora).</Fuente>
    </div>
  )
}
