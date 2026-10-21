import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type ReunionFila, type ReunionesPeriodo } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, type Columna } from '../components/Bloques'
import { MESES, fmtFecha, fmtN } from '../formato'
import type { ContextoTablero } from './contexto'

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
const COLOR_RESOLUCION: Record<string, string> = { Resuelto: '#2e8b57', Parcial: '#01aae3', Pendiente: '#c98a12', Derivado: '#398ebd' }

const COL_REUNIONES: Columna<ReunionFila>[] = [
  { titulo: 'Fecha', valor: (f) => f.fecha, render: (f) => fmtFecha(f.fecha) },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Temas', valor: (f) => f.temas.join(', '), render: (f) => f.temas.map(capital).join(' · ') || '—' },
  { titulo: 'Resolución', valor: (f) => f.resolucion },
]

type FilaLocalidad = ReunionesPeriodo['por_localidad'][number]
const COL_LOCALIDADES: Columna<FilaLocalidad>[] = [
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Reuniones', valor: (f) => f.reuniones, numerica: true },
  { titulo: 'Pendientes', valor: (f) => f.pendientes, numerica: true },
  { titulo: 'Última', valor: (f) => f.ultima, render: (f) => fmtFecha(f.ultima) },
]

/** Reuniones en el Panal (Etapa 5): planilla "1. REGISTRO REUNIONES". Sin el detalle de cada
 * reunión ni de su resolución (spec-datos-externos-fase5-gestion-territorial.md §5). */
export function ReunionesVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'reuniones', ctx.codigos], queryFn: () => tableroApi.reuniones(ctx.codigos) })
  const reuniones = useMemo(
    () => (!q.data ? [] : anio === 'gestion' ? q.data.reuniones : q.data.reuniones.filter((r) => r.fecha.startsWith(String(anio)))),
    [q.data, anio],
  )

  if (q.isError) return <Aviso tono="error">No pudimos cargar las reuniones. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.reuniones.length) {
    return <Aviso tono="warn">{ctx.codigos ? 'No hay reuniones registradas para este filtro.' : 'Todavía no hay datos sincronizados de la planilla de reuniones.'}</Aviso>
  }
  const p = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.periodo ?? d.gestion
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const desactualizada = d.ultima_fecha != null && d.ultima_fecha < `${new Date().getFullYear()}-01-01`

  return (
    <div className="space-y-4">
      {desactualizada && (
        <Aviso tono="warn">
          La planilla llega hasta el {fmtFecha(d.ultima_fecha)}: no tiene reuniones posteriores. Le preguntamos al área si se dejó de cargar.
        </Aviso>
      )}
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión.">
        <SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de las reuniones" />
      </Panel>

      <Kpis>
        <Kpi label="Reuniones" valor={fmtN(p.reuniones)} detalle={periodo} />
        <Kpi label="Localidades" valor={fmtN(p.localidades)} detalle="con al menos una reunión" />
        {p.por_resolucion.slice(0, 3).map((r) => (
          <Kpi key={r.clave} label={capital(r.clave)} valor={fmtN(r.cantidad)} detalle="reuniones" />
        ))}
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo={anio === 'gestion' ? 'Reuniones por año' : `Reuniones por mes de ${anio}`}>
          {anio === 'gestion' ? (
            <BarChart labels={d.por_anio.map((a) => String(a.anio))} values={d.por_anio.map((a) => a.periodo.reuniones)} height={220} />
          ) : (
            <BarChart labels={MESES} values={p.mensual} height={220} />
          )}
        </Panel>
        <Panel titulo="Por tema" ayuda="Una reunión suma en cada uno de sus temas.">
          <BarChart labels={p.por_tema.map((t) => capital(t.clave))} values={p.por_tema.map((t) => t.cantidad)} horizontal height={Math.max(200, p.por_tema.length * 22)} />
        </Panel>
        <Panel titulo="Por resolución">
          <DonutChart
            labels={p.por_resolucion.map((r) => `${capital(r.clave)} (${r.cantidad})`)}
            values={p.por_resolucion.map((r) => r.cantidad)}
            colors={p.por_resolucion.map((r) => COLOR_RESOLUCION[r.clave] ?? '#c9d6e2')}
            height={220}
          />
        </Panel>
      </div>

      <Panel titulo="Por localidad" ayuda={`Reuniones ${periodo}, de mayor a menor.`}>
        <Tabla columnas={COL_LOCALIDADES} filas={p.por_localidad} archivo="reuniones_por_localidad.xlsx" />
      </Panel>
      <Panel titulo="Reuniones" ayuda="Sin el detalle de la reunión ni de la resolución.">
        <Tabla columnas={COL_REUNIONES} filas={reuniones} archivo="reuniones.xlsx" />
      </Panel>
      <Fuente>planilla "1. REGISTRO REUNIONES" de Gobierno, pestaña Reuniones (sincronizada a diario).</Fuente>
    </div>
  )
}
