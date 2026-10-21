import { useQuery } from '@tanstack/react-query'
import { tableroApi, type VisitasGobernadorFila } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { CoberturaPorDepartamento, CoberturaVelocimetros } from '../components/Cobertura'
import { fmtFecha, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const TIPO: Record<string, string> = { MU: 'Municipio', CO: 'Comuna' }

const COL_VISITADAS: Columna<VisitasGobernadorFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Tipo', valor: (f) => TIPO[f.tipo ?? ''] ?? f.tipo },
  { titulo: 'Habitantes', valor: (f) => f.rango_habitantes },
  { titulo: 'Última visita', valor: (f) => f.fecha_ultima, render: (f) => (f.fecha_ultima ? fmtFecha(f.fecha_ultima) : <span className="text-amber-700">Sin fecha cargada</span>) },
]
const COL_NO: Columna<VisitasGobernadorFila>[] = COL_VISITADAS.slice(0, 4)

/** Visitas del Gobernador (Etapa 5): pestaña `Visitas Gober` de la planilla 2. Una foto de hoy:
 * no tiene filtro de año. */
export function VisitasGobernadorVista({ ctx }: { ctx: ContextoTablero }) {
  const q = useQuery({ queryKey: ['tablero-gobierno', 'visitas-gobernador', ctx.codigos], queryFn: () => tableroApi.visitasGobernador(ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar las visitas del Gobernador. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.con_datos) return <Aviso tono="warn">Todavía no hay datos sincronizados de las visitas del Gobernador.</Aviso>
  const c = d.cobertura
  const visitadas = d.localidades.filter((l) => l.visitada).sort((a, b) => (b.fecha_ultima ?? '').localeCompare(a.fecha_ultima ?? ''))
  const noVisitadas = d.localidades.filter((l) => !l.visitada)

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Localidades visitadas" valor={fmtN(c.visitadas)} detalle={`de ${fmtN(c.total)} · ${fmtPct(c.total ? c.visitadas / c.total : null)}`} />
        <Kpi label="Aún no visitadas" valor={fmtN(c.total - c.visitadas)} />
        <Kpi label="Municipios visitados" valor={fmtN(c.municipios_visitados)} detalle={`de ${fmtN(c.municipios)}`} />
        <Kpi label="Comunas visitadas" valor={fmtN(c.comunas_visitadas)} detalle={`de ${fmtN(c.comunas)}`} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel titulo="Cobertura" ayuda="Localidades que el Gobernador visitó al menos una vez en la gestión.">
          <CoberturaVelocimetros c={c} color="#398ebd" />
        </Panel>
        <Panel titulo="Por cantidad de habitantes" ayuda="Visitadas sobre el total de cada rango.">
          <table className="w-full text-sm">
            <tbody>
              {d.por_rango.map((r) => (
                <tr key={r.rango} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-gov-navy">{r.rango}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtN(r.visitadas)} de {fmtN(r.total)}</td>
                  <td className="py-1.5 text-right tabular-nums w-20">{fmtPct(r.total ? r.visitadas / r.total : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel titulo="Cobertura por departamento" ayuda="De menor a mayor cobertura.">
        <CoberturaPorDepartamento filas={d.por_departamento} archivo="visitas_gobernador_departamentos.xlsx" />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel titulo="Localidades visitadas" ayuda="Con la fecha de la última visita.">
          <Tabla columnas={COL_VISITADAS} filas={visitadas} archivo="gobernador_visitadas.xlsx" />
        </Panel>
        <Panel titulo="Localidades aún no visitadas">
          <Tabla columnas={COL_NO} filas={noVisitadas} archivo="gobernador_no_visitadas.xlsx" />
        </Panel>
      </div>
      <Fuente>planilla "2. RECORRIDO Y VISITAS" de Gobierno, pestaña Visitas Gober (sincronizada a diario).</Fuente>
    </div>
  )
}
