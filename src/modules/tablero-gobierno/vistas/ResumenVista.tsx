import { useQuery } from '@tanstack/react-query'
import { tableroApi, type ResumenFila } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtMonto, fmtN, fmtPeriodo, fmtPesos } from '../formato'
import type { ContextoTablero } from './contexto'

const montos: Columna<ResumenFila>[] = [
  { titulo: 'Población', valor: (f) => f.poblacion, render: (f) => fmtN(f.poblacion), numerica: true },
  { titulo: 'COPA neta', valor: (f) => f.copa, render: (f) => fmtMonto(f.copa), numerica: true },
  { titulo: 'FOFINDES neto', valor: (f) => f.fofindes, render: (f) => fmtMonto(f.fofindes), numerica: true },
  { titulo: 'Fondo Ambiental', valor: (f) => f.fondo_ambiental, render: (f) => fmtMonto(f.fondo_ambiental), numerica: true },
  { titulo: 'Total', valor: (f) => f.total, render: (f) => fmtMonto(f.total), numerica: true },
  { titulo: 'Por habitante', valor: (f) => f.por_habitante, render: (f) => fmtPesos(f.por_habitante), numerica: true },
]

const COL_DEPTO: Columna<ResumenFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidades', valor: (f) => f.localidades, numerica: true },
  ...montos,
]

const COL_LOC: Columna<ResumenFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Tipo', valor: (f) => f.tipo },
  ...montos,
]

const totalFila = (t: ResumenFila, vacias: number) => [
  'Total', ...Array<string>(vacias).fill(''),
  fmtN(t.poblacion), fmtMonto(t.copa), fmtMonto(t.fofindes), fmtMonto(t.fondo_ambiental), fmtMonto(t.total), fmtPesos(t.por_habitante),
]

/** Resumen general: COPA + FOFINDES netos (Etapa 2) y Fondo Ambiental pagado a localidades
 * (Etapa 3, spec-datos-externos-fase3-fondos.md §4). ATP, FOCOM, adelantos y Fondo Federal siguen
 * sin fuente; el semáforo ATP/COPA+FOFIN llega con la Fase 4. */
export function ResumenVista({ ctx }: { ctx: ContextoTablero }) {
  const q = useQuery({ queryKey: ['tablero-gobierno', 'resumen', ctx.anio, ctx.codigos], queryFn: () => tableroApi.resumen(ctx.anio, ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar el resumen. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const t = d.total
  const porLocalidad = !!ctx.codigos

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Total transferido" valor={fmtMonto(t.total)} detalle={d.periodo_hasta ? `${d.anio}, hasta ${fmtPeriodo(d.periodo_hasta)}` : `sin datos en ${d.anio}`} />
        <Kpi label="Por habitante" valor={fmtPesos(t.por_habitante)} detalle="total ÷ población 2022" />
        <Kpi label="Coparticipación neta" valor={fmtMonto(t.copa)} />
        <Kpi label="FOFINDES neto" valor={fmtMonto(t.fofindes)} />
        <Kpi label="Fondo Ambiental" valor={fmtMonto(t.fondo_ambiental)} detalle="pagado a localidades" />
      </Kpis>

      <Aviso tono="warn">
        Este total es <b>COPA + FOFINDES + Fondo Ambiental</b>. FOCOM, adelantos y Fondo Federal esperan su fuente del área; ATP y el semáforo
        ATP / (COPA + FOFINDES) llegan con la Fase 4, cuando esté la regla para no contar dos veces ATP Interno y Compromisos. Lo de comunidades
        regionales no entra, igual que en el Looker.
      </Aviso>

      {porLocalidad ? (
        <Panel titulo="Resumen por localidad" ayuda="Montos netos transferidos en el año.">
          <Tabla columnas={COL_LOC} filas={d.por_localidad} archivo={`resumen_localidades_${d.anio}.xlsx`} total={totalFila(t, 2)} />
        </Panel>
      ) : (
        <>
          <Panel titulo="Resumen por departamento" ayuda="Montos netos transferidos en el año. Elegí un departamento arriba para ver sus localidades.">
            <Tabla columnas={COL_DEPTO} filas={d.por_departamento} archivo={`resumen_departamentos_${d.anio}.xlsx`} total={totalFila(t, 1)} />
          </Panel>
          <Panel titulo="Resumen por localidad" ayuda="Las 427 localidades.">
            <Tabla columnas={COL_LOC} filas={d.por_localidad} archivo={`resumen_localidades_${d.anio}.xlsx`} total={totalFila(t, 2)} />
          </Panel>
        </>
      )}
      <Fuente>planillas "11.1 COPARTICIPACION", "11.1 FOFINDES" y "9. FONDO AMBIENTAL" de Gobierno; población del Censo 2022 (INDEC).</Fuente>
    </div>
  )
}
