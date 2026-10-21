import { useQuery } from '@tanstack/react-query'
import { tableroApi, type ResumenFila } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtMonto, fmtN, fmtPct, fmtPeriodo, fmtPesos } from '../formato'
import type { ContextoTablero } from './contexto'

/** Cortes del semáforo ATP / (COPA + FOFINDES) leídos del Looker (spec-tablero-gobierno-panel.md §2.5 #1). */
function colorSemaforo(v: number | null): string | null {
  if (v == null) return null
  return v >= 0.015 ? '#2e8b57' : v >= 0.008 ? '#c98a12' : '#c0392b'
}

function Semaforo({ valor }: { valor: number | null }) {
  const color = colorSemaforo(valor)
  return (
    <span className="inline-flex items-center gap-1.5">
      {color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden />}
      {fmtPct(valor)}
    </span>
  )
}

const montos: Columna<ResumenFila>[] = [
  { titulo: 'Población', valor: (f) => f.poblacion, render: (f) => fmtN(f.poblacion), numerica: true },
  { titulo: 'ATP Interno', valor: (f) => f.atp, render: (f) => fmtMonto(f.atp), numerica: true },
  { titulo: 'COPA neta', valor: (f) => f.copa, render: (f) => fmtMonto(f.copa), numerica: true },
  { titulo: 'FOFINDES neto', valor: (f) => f.fofindes, render: (f) => fmtMonto(f.fofindes), numerica: true },
  { titulo: 'ATP / COPA+FOFIN', valor: (f) => f.atp_sobre_copa_fofin, render: (f) => <Semaforo valor={f.atp_sobre_copa_fofin} />, numerica: true },
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

// La fila de total no lleva color en el semáforo, como en el Looker.
const totalFila = (t: ResumenFila, vacias: number) => [
  'Total', ...Array<string>(vacias).fill(''),
  fmtN(t.poblacion), fmtMonto(t.atp), fmtMonto(t.copa), fmtMonto(t.fofindes), fmtPct(t.atp_sobre_copa_fofin), fmtMonto(t.fondo_ambiental),
  fmtMonto(t.total), fmtPesos(t.por_habitante),
]

/** Resumen general: COPA + FOFINDES netos (Etapa 2), Fondo Ambiental pagado a localidades
 * (Etapa 3) y ATP Interno con su semáforo (Etapa 4, spec-atp-interno.md §4.3). FOCOM, adelantos
 * y Fondo Federal siguen sin fuente. ATP Compromisos nunca entra. */
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
        <Kpi label="ATP Interno" valor={d.atp_disponible ? fmtMonto(t.atp) : 'No disponible'} detalle={d.atp_disponible ? `${fmtPct(t.atp_sobre_copa_fofin)} de COPA + FOFINDES` : undefined} />
        <Kpi label="Coparticipación neta" valor={fmtMonto(t.copa)} />
        <Kpi label="FOFINDES neto" valor={fmtMonto(t.fofindes)} />
        <Kpi label="Fondo Ambiental" valor={fmtMonto(t.fondo_ambiental)} detalle="pagado a localidades" />
      </Kpis>

      {!d.atp_disponible && (
        <Aviso tono="warn">No pudimos leer el ATP Interno en este momento: el total de abajo <b>no lo incluye</b>. Probá de nuevo en un rato.</Aviso>
      )}
      <Aviso tono="warn">
        Este total es <b>ATP Interno + COPA + FOFINDES + Fondo Ambiental</b>. FOCOM, adelantos y Fondo Federal esperan su fuente del área. ATP Compromisos
        no entra. Lo de comunidades regionales tampoco, igual que en el Looker.
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
      <p className="text-xs text-gray-500">
        Semáforo ATP / (COPA + FOFINDES): verde desde 1,5 %, amarillo de 0,8 % a 1,5 %, rojo debajo de 0,8 % (cortes del Looker).
      </p>
      <p className="text-xs text-gray-500 border-t border-slate-200 pt-2">
        <b>Nota pendiente con el área:</b> ATP Interno entra en el total y en el semáforo con el mismo criterio que el Looker. Falta definirlo con el
        área: los compromisos del Gobernador también se cargan en ATP Interno, y todavía no hay una regla acordada para identificar esos pagos.
      </p>
      <Fuente>
        planillas "4. ATP 2026", "11.1 COPARTICIPACION", "11.1 FOFINDES" y "9. FONDO AMBIENTAL" de Gobierno; población del Censo 2022 (INDEC).
      </Fuente>
    </div>
  )
}
