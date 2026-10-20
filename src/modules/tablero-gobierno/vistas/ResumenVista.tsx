import { useQuery } from '@tanstack/react-query'
import { tableroApi, type ResumenFila } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtMonto, fmtN, fmtPeriodo, fmtPesos } from '../formato'
import type { ContextoTablero } from './contexto'

const montos: Columna<ResumenFila>[] = [
  { titulo: 'Población', valor: (f) => f.poblacion, render: (f) => fmtN(f.poblacion), numerica: true },
  { titulo: 'COPA neta', valor: (f) => f.copa, render: (f) => fmtMonto(f.copa), numerica: true },
  { titulo: 'FOFINDES neto', valor: (f) => f.fofindes, render: (f) => fmtMonto(f.fofindes), numerica: true },
  { titulo: 'COPA + FOFINDES', valor: (f) => f.total, render: (f) => fmtMonto(f.total), numerica: true },
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
  fmtN(t.poblacion), fmtMonto(t.copa), fmtMonto(t.fofindes), fmtMonto(t.total), fmtPesos(t.por_habitante),
]

/** Resumen general (Etapa 2): por ahora COPA + FOFINDES netos, desde las planillas de
 * Gobierno. Los demás fondos del total del Looker llegan con la Fase 3 y el semáforo
 * ATP/COPA+FOFIN con la Fase 4 (spec-datos-externos-fase2-transferencias.md §5.2). */
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
        <Kpi label="COPA + FOFINDES netos" valor={fmtMonto(t.total)} detalle={d.periodo_hasta ? `${d.anio}, hasta ${fmtPeriodo(d.periodo_hasta)}` : `sin datos en ${d.anio}`} />
        <Kpi label="Por habitante" valor={fmtPesos(t.por_habitante)} detalle="total ÷ población 2022" />
        <Kpi label="Coparticipación neta" valor={fmtMonto(t.copa)} />
        <Kpi label="FOFINDES neto" valor={fmtMonto(t.fofindes)} />
      </Kpis>

      <Aviso tono="warn">
        Este total todavía es solo <b>COPA + FOFINDES</b>. ATP, FOCOM, adelantos, Fondo Federal y Fondo Ambiental se suman con la Fase 3, y el
        semáforo ATP / (COPA + FOFINDES) con la Fase 4, cuando esté la regla para no contar dos veces ATP Interno y Compromisos.
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
      <Fuente>planillas "11.1 COPARTICIPACION" y "11.1 FOFINDES" de Gobierno; población del Censo 2022 (INDEC).</Fuente>
    </div>
  )
}
