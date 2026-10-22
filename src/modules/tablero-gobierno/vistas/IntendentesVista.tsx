import { useQuery } from '@tanstack/react-query'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type IntendenteFila, type Intendentes } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const COLORES = ['#172c3f', '#01aae3', '#398ebd', '#c98a12', '#2e8b57', '#8a6bbf', '#c9d6e2', '#b0413e']
const siNo = (v: boolean | null) => (v == null ? '—' : v ? 'Sí' : 'No')

const COLUMNAS: Columna<IntendenteFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Tipo', valor: (f) => (f.tipo === 'MU' ? 'Municipio' : f.tipo === 'CO' ? 'Comuna' : f.tipo) },
  { titulo: 'Intendente / jefe comunal', valor: (f) => f.intendente },
  { titulo: 'Partido', valor: (f) => f.partido },
  { titulo: 'Alineación', valor: (f) => f.alineacion },
  { titulo: 'Reelecto', valor: (f) => siNo(f.reelecto) },
  { titulo: 'Continuidad', valor: (f) => siNo(f.continuidad) },
  { titulo: 'Celular', valor: (f) => f.celular, render: (f) => (f.celular ? <a href={`tel:${f.celular}`} className="text-gov-blue hover:underline">{f.celular}</a> : '—') },
  {
    titulo: 'Foto',
    valor: (f) => f.foto_url,
    render: (f) => (f.foto_url ? <a href={f.foto_url} target="_blank" rel="noreferrer" className="text-gov-blue hover:underline">Ver</a> : '—'),
  },
]

type FilaDepto = Intendentes['por_departamento'][number]

/** Intendentes (Etapa 6, solo Admin y Autoridad): pestaña `Intendentes` de "1. REGISTRO
 * REUNIONES". La alineación sale de la pestaña `GANADORES` de la planilla de elecciones. */
export function IntendentesVista({ ctx }: { ctx: ContextoTablero }) {
  const q = useQuery({ queryKey: ['tablero-gobierno', 'intendentes', ctx.codigos], queryFn: () => tableroApi.intendentes(ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar el padrón de intendentes. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const k = d.kpis
  if (!k.con_intendente) return <Aviso tono="warn">Todavía no hay datos sincronizados del padrón de intendentes.</Aviso>
  const alineaciones = d.por_alineacion.map((a) => a.clave)
  const colDeptos: Columna<FilaDepto>[] = [
    { titulo: 'Departamento', valor: (f) => f.departamento },
    { titulo: 'Gobiernos locales', valor: (f) => f.total, numerica: true },
    ...alineaciones.map((a) => ({ titulo: a.charAt(0) + a.slice(1).toLowerCase(), valor: (f: FilaDepto) => f.por_alineacion[a] ?? 0, numerica: true })),
  ]
  const partidos = d.por_partido.slice(0, 15)

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Gobiernos locales" valor={fmtN(k.con_intendente)} detalle={`de ${fmtN(k.gobiernos_locales)} con intendente cargado`} />
        <Kpi label="Reelectos" valor={fmtN(k.reelectos)} detalle={fmtPct(k.con_intendente ? k.reelectos / k.con_intendente : null)} />
        <Kpi label="Con continuidad" valor={fmtN(k.continuidad)} detalle={fmtPct(k.con_intendente ? k.continuidad / k.con_intendente : null)} />
        <Kpi label="Con celular" valor={fmtN(k.con_celular)} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Por alineación" ayuda="Clasificación de la planilla de elecciones (pestaña GANADORES).">
          <DonutChart
            labels={d.por_alineacion.map((a) => `${a.clave} (${a.cantidad})`)}
            values={d.por_alineacion.map((a) => a.cantidad)}
            colors={d.por_alineacion.map((_, i) => COLORES[i % COLORES.length])}
            height={240}
          />
        </Panel>
        <Panel titulo="Por partido" ayuda={d.por_partido.length > 15 ? `Los 15 con más gobiernos locales, de ${d.por_partido.length}.` : undefined}>
          <BarChart labels={partidos.map((p) => p.clave)} values={partidos.map((p) => p.cantidad)} horizontal height={Math.max(220, partidos.length * 22)} />
        </Panel>
      </div>

      <Panel titulo="Por departamento" ayuda="Gobiernos locales por alineación del intendente.">
        <Tabla columnas={colDeptos} filas={d.por_departamento} archivo="intendentes_por_departamento.xlsx" />
      </Panel>

      <Panel titulo="Intendentes y jefes comunales" ayuda="Datos personales: no los compartas fuera del área.">
        <Tabla columnas={COLUMNAS} filas={d.intendentes} archivo="intendentes.xlsx" />
      </Panel>
      <Aviso>Legisladores: no están en ninguna planilla compartida. Se los pedimos al área.</Aviso>
      <Fuente>planilla "1. REGISTRO REUNIONES" de Gobierno, pestaña Intendentes (sincronizada a diario).</Fuente>
    </div>
  )
}
