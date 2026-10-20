import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type CregCuota, type CregTipo } from '../api/tablero.api'
import { Aviso, Cargando, EstadoFondo, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, colorEstadoFondo, type Columna } from '../components/Bloques'
import { fmtFecha, fmtMonto, fmtN } from '../formato'
import type { ContextoTablero } from './contexto'

const COLUMNAS: Columna<CregCuota>[] = [
  { titulo: 'Año', valor: (f) => f.anio },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Comunidad regional', valor: (f) => f.comunidad },
  { titulo: 'Tipo', valor: (f) => f.tipo },
  { titulo: 'Destino', valor: (f) => f.destino },
  { titulo: 'Cuota', valor: (f) => f.cuota, numerica: true },
  { titulo: 'Monto cuota', valor: (f) => f.monto_cuota, render: (f) => fmtMonto(f.monto_cuota), numerica: true },
  { titulo: 'Estado', valor: (f) => f.estado, render: (f) => <EstadoFondo estado={f.estado} /> },
  { titulo: 'Pago', valor: (f) => f.fecha_pago, render: (f) => fmtFecha(f.fecha_pago) },
  { titulo: 'Rendición', valor: (f) => f.fecha_rendicion, render: (f) => fmtFecha(f.fecha_rendicion) },
  { titulo: 'Expediente', valor: (f) => f.expediente },
]

const COL_OBRAS: Columna<CregCuota>[] = [
  { titulo: 'Año', valor: (f) => f.anio },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Comunidad regional', valor: (f) => f.comunidad },
  { titulo: 'Destino', valor: (f) => f.destino },
  { titulo: 'Monto de la obra', valor: (f) => f.monto, render: (f) => fmtMonto(f.monto), numerica: true },
  { titulo: 'Cuota', valor: (f) => f.cuota, numerica: true },
  { titulo: 'Monto cuota', valor: (f) => f.monto_cuota, render: (f) => fmtMonto(f.monto_cuota), numerica: true },
  { titulo: 'Estado', valor: (f) => f.estado, render: (f) => <EstadoFondo estado={f.estado} /> },
]

interface FilaTipo {
  tipo: string
  t: CregTipo
}

const COL_TIPOS: Columna<FilaTipo>[] = [
  { titulo: 'Fondo', valor: (f) => f.tipo },
  { titulo: 'Crédito vigente', valor: (f) => f.t.credito, render: (f) => fmtMonto(f.t.credito), numerica: true },
  { titulo: 'Cuotas', valor: (f) => f.t.cuotas, numerica: true },
  { titulo: 'Monto de las cuotas', valor: (f) => f.t.monto_cuotas, render: (f) => fmtMonto(f.t.monto_cuotas), numerica: true },
  { titulo: 'Pagado', valor: (f) => f.t.pagado, render: (f) => fmtMonto(f.t.pagado), numerica: true },
  { titulo: 'A pagar', valor: (f) => f.t.a_pagar, render: (f) => fmtMonto(f.t.a_pagar), numerica: true },
  { titulo: 'Saldo', valor: (f) => f.t.saldo, render: (f) => fmtMonto(f.t.saldo), numerica: true },
]

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** Comunidades Regionales (Etapa 3): planilla "17. Comunidades Regionales". No son localidades:
 * con un filtro territorial se muestra la del departamento (spec-datos-externos-fase3-fondos.md §4). */
export function ComunidadesRegionalesVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({
    queryKey: ['tablero-gobierno', 'comunidades-regionales', ctx.codigos],
    queryFn: () => tableroApi.comunidadesRegionales(ctx.anio, ctx.codigos),
  })
  const cuotas = useMemo(
    () => (!q.data ? [] : anio === 'gestion' ? q.data.cuotas : q.data.cuotas.filter((c) => c.anio === anio)),
    [q.data, anio],
  )

  if (q.isError) return <Aviso tono="error">No pudimos cargar las Comunidades Regionales. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const avisoFiltro = ctx.localidad ? (
    <Aviso>Las comunidades regionales no son localidades: se muestra la del departamento {ctx.localidad.departamento}.</Aviso>
  ) : null
  if (!d.gestion) {
    return (
      <div className="space-y-4">
        {avisoFiltro}
        <Aviso tono="warn">{ctx.codigos ? 'No hay cuotas de comunidades regionales para este departamento.' : 'Todavía no hay datos sincronizados de la planilla de Comunidades Regionales.'}</Aviso>
      </div>
    )
  }
  const k = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.kpis ?? d.gestion
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const obras = cuotas.filter((c) => (c.tipo ?? '').toLowerCase().startsWith('obra'))
  const conMonto = k.estados.filter((e) => e.monto > 0)
  const sinCredito = ctx.codigos ? 'es del fondo entero: solo sin filtro' : periodo

  return (
    <div className="space-y-4">
      {avisoFiltro}
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión.">
        <SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de Comunidades Regionales" />
      </Panel>

      <Kpis>
        <Kpi label="Crédito vigente" valor={fmtMonto(k.total.credito)} detalle={sinCredito} />
        <Kpi label="Fondos para obras" valor={fmtMonto(k.obras.credito)} detalle={sinCredito} />
        <Kpi label="Cuotas" valor={fmtMonto(k.total.monto_cuotas)} detalle={`${fmtN(k.total.cuotas)} cuotas sin anuladas · ${fmtN(k.comunidades)} comunidades`} />
        <Kpi label="Pagado" valor={fmtMonto(k.total.pagado)} detalle={`a pagar ${fmtMonto(k.total.a_pagar)}`} />
        <Kpi label="Saldo" valor={fmtMonto(k.total.saldo)} detalle="crédito − cuotas no anuladas" />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel titulo="Funcionamiento y obras" ayuda={`Crédito, cuotas y saldo ${periodo}. Las cuotas anuladas no cuentan.`}>
          <Tabla
            columnas={COL_TIPOS}
            filas={[
              { tipo: 'Funcionamiento', t: k.funcionamiento },
              { tipo: 'Obras', t: k.obras },
            ]}
            archivo="comunidades_regionales_resumen.xlsx"
            total={['Total', fmtMonto(k.total.credito), fmtN(k.total.cuotas), fmtMonto(k.total.monto_cuotas), fmtMonto(k.total.pagado), fmtMonto(k.total.a_pagar), fmtMonto(k.total.saldo)]}
          />
        </Panel>
        <Panel titulo="Cuotas por estado" ayuda="Monto de las cuotas, incluidas las anuladas.">
          <DonutChart
            labels={conMonto.map((e) => `${capital(e.estado)} (${e.cantidad})`)}
            values={conMonto.map((e) => e.monto)}
            colors={conMonto.map((e) => colorEstadoFondo(e.estado))}
            height={240}
          />
        </Panel>
      </div>

      <Panel titulo="Fondos para obras" ayuda={`Obras financiadas ${periodo}.`}>
        <Tabla columnas={COL_OBRAS} filas={obras} archivo="comunidades_regionales_obras.xlsx" />
      </Panel>

      <Panel titulo="Cuotas" ayuda={`Todas las cuotas ${periodo}, de funcionamiento y de obras.`}>
        <Tabla columnas={COLUMNAS} filas={cuotas} archivo="comunidades_regionales_cuotas.xlsx" />
      </Panel>

      <Fuente>planilla "17. Comunidades Regionales" de Gobierno, pestañas Fondo y Control (sincronizada a diario).</Fuente>
    </div>
  )
}
