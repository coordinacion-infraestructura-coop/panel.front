import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type FocomFila } from '../api/tablero.api'
import { Aviso, Cargando, EstadoFondo, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, type Columna } from '../components/Bloques'
import { fmtFecha, fmtMonto, fmtN } from '../formato'
import type { ContextoTablero } from './contexto'

const COLUMNAS: Columna<FocomFila>[] = [
  { titulo: 'ID', valor: (f) => f.id_focom },
  { titulo: 'Año', valor: (f) => f.anio },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Concepto', valor: (f) => f.concepto, render: (f) => <span className="inline-block max-w-[280px] truncate align-bottom" title={f.concepto ?? ''}>{f.concepto ?? '—'}</span> },
  { titulo: 'Categoría', valor: (f) => f.categoria },
  { titulo: 'Monto', valor: (f) => f.monto, render: (f) => fmtMonto(f.monto), numerica: true },
  { titulo: 'Estado', valor: (f) => f.estado, render: (f) => <EstadoFondo estado={f.estado} /> },
  { titulo: 'Fecha pago', valor: (f) => f.fecha_pago, render: (f) => fmtFecha(f.fecha_pago) },
  { titulo: 'Estado obra', valor: (f) => f.estado_obra },
  { titulo: 'Convenio', valor: (f) => f.convenio },
  { titulo: 'Fecha convenio', valor: (f) => f.fecha_convenio, render: (f) => fmtFecha(f.fecha_convenio) },
  { titulo: 'Expediente', valor: (f) => f.expediente },
  { titulo: 'Resolución', valor: (f) => f.resolucion },
]

// Los tres estados de la planilla con colores distintos: "Pagado ATP" no es FOCOM puro.
const COLOR_ESTADO: Record<string, string> = { PAGADO: '#2e8b57', 'PAGADO ATP': '#398ebd', 'PENDIENTE ATP': '#c98a12' }
const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** FOCOM: pestaña FOCOM de la planilla "Gobierno" de la Privada del Gobernador
 * (spec-datos-externos-privada-gobernador.md §7.2). Filtro de año propio, como FOMMEP. */
export function FocomVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'focom', ctx.codigos], queryFn: () => tableroApi.focom(ctx.anio, ctx.codigos) })
  const filas = useMemo(
    () => (!q.data ? [] : anio === 'gestion' ? q.data.convenios : q.data.convenios.filter((c) => c.anio === anio)),
    [q.data, anio],
  )

  if (q.isError) return <Aviso tono="error">No pudimos cargar FOCOM. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.gestion) {
    return <Aviso tono="warn">{ctx.codigos ? 'No hay convenios FOCOM para este filtro.' : 'Todavía no hay datos sincronizados de FOCOM.'}</Aviso>
  }
  const k = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.kpis ?? d.gestion
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const conMonto = k.estados.filter((e) => e.monto > 0)
  const categorias = k.categorias.slice(0, 10)

  return (
    <div className="space-y-4">
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión.">
        <SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de FOCOM" />
      </Panel>

      <Kpis>
        <Kpi label="FOCOM pagado" valor={fmtMonto(k.puro)} detalle={`${fmtN(k.convenios_puro)} convenios pagados por FOCOM`} />
        <Kpi label="Pagado por ATP" valor={fmtMonto(k.pagado_atp)} detalle="ya está en ATP: no se suma" />
        <Kpi label="Pendiente por ATP" valor={fmtMonto(k.pendiente_atp)} />
        <Kpi label="Localidades con FOCOM" valor={fmtN(k.localidades)} detalle={periodo} />
        <Kpi label="Convenios" valor={fmtN(k.convenios)} detalle={`${fmtMonto(k.monto)} en total`} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel titulo="Cómo se pagó" ayuda="Monto de los convenios por estado.">
          {conMonto.length ? (
            <DonutChart
              labels={conMonto.map((e) => `${capital(e.estado)} (${e.cantidad})`)}
              values={conMonto.map((e) => e.monto)}
              colors={conMonto.map((e) => COLOR_ESTADO[e.estado] ?? '#c9d6e2')}
              height={240}
            />
          ) : (
            <p className="text-sm text-gray-500">Sin convenios {periodo}.</p>
          )}
        </Panel>
        <Panel titulo="Qué se financió" ayuda="Monto por categoría del convenio, en millones.">
          <BarChart
            labels={categorias.map((c) => capital(c.objeto))}
            values={categorias.map((c) => c.monto / 1e6)}
            horizontal
            height={Math.max(180, categorias.length * 30)}
            tooltipSuffix=" M"
          />
        </Panel>
      </div>

      <Panel titulo="Estado de las obras" ayuda="Cantidad de convenios según el estado de obra que informa la planilla.">
        <Kpis>
          {k.estados_obra.map((e) => (
            <Kpi key={e.estado} label={capital(e.estado)} valor={fmtN(e.cantidad)} detalle="convenios" />
          ))}
        </Kpis>
      </Panel>

      <Panel titulo="Convenios" ayuda={`Convenios ${periodo}.`}>
        <Tabla
          columnas={COLUMNAS}
          filas={filas}
          archivo="focom.xlsx"
          total={['Total', '', '', '', '', '', fmtMonto(k.monto), '', '', '', '', '', '', '']}
        />
      </Panel>

      <Aviso>
        "FOCOM pagado" es lo que pagó el fondo (FOCOM puro). Los convenios "Pagado ATP" y "Pendiente ATP" se pagan por ATP y ya están contados
        ahí: no se suman a ningún total de transferencias. FOCOM todavía no entra en el Resumen general.
      </Aviso>
      <Fuente>planilla "Gobierno" de la Privada del Gobernador, pestaña FOCOM (sincronizada a diario).</Fuente>
    </div>
  )
}
