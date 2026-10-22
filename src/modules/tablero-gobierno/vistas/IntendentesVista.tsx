import { useQuery } from '@tanstack/react-query'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type CruceFila, type IntendenteFila, type Intendentes } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtFecha, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const COLORES = ['#172c3f', '#01aae3', '#398ebd', '#c98a12', '#2e8b57', '#8a6bbf', '#c9d6e2', '#b0413e']
const siNo = (v: boolean | null) => (v == null ? '—' : v ? 'Sí' : 'No')

const COLUMNAS: Columna<IntendenteFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Tipo', valor: (f) => (f.tipo === 'MU' ? 'Municipio' : f.tipo === 'CO' ? 'Comuna' : f.tipo) },
  { titulo: 'Intendente / jefe comunal', valor: (f) => f.intendente, render: (f) => <ConOrigen valor={f.intendente} origen={f.origen_intendente} /> },
  { titulo: 'Partido', valor: (f) => f.partido, render: (f) => <ConOrigen valor={f.partido} origen={f.origen_partido} /> },
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

/** Valor del padrón combinado: si vino de Privada (Gobierno no tenía dato), se marca. */
function ConOrigen({ valor, origen }: { valor: string | null; origen: string | null }) {
  if (!valor) return <>—</>
  if (origen !== 'privada') return <>{valor}</>
  return (
    <span title="Gobierno no tiene este dato: viene del padrón de Privada">
      {valor} <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">Privada</span>
    </span>
  )
}

const ESTADOS: Record<string, string> = {
  igual: 'Iguales',
  igual_otro_orden: 'Iguales en otro orden',
  parecido: 'Parecidos',
  distinto: 'Distintos',
  solo_gobierno: 'Solo en Gobierno',
  solo_privada: 'Solo en Privada',
  sin_dato: 'Sin dato en ninguno',
}

const COL_CRUCE: Columna<CruceFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Dato', valor: (f) => (f.campo === 'intendente' ? 'Intendente' : 'Partido') },
  { titulo: 'Cruce', valor: (f) => ESTADOS[f.estado] ?? f.estado },
  { titulo: 'Gobierno', valor: (f) => f.gobierno },
  { titulo: 'Privada (original)', valor: (f) => f.privada },
]

function Cruce({ cruce }: { cruce: NonNullable<Intendentes['cruce']> }) {
  if (!cruce.disponible) {
    return <Aviso tono="warn">Todavía no se pudo leer el padrón de Privada: el cruce aparece después del próximo sync.</Aviso>
  }
  return (
    <Panel
      titulo="Cruce con Privada"
      ayuda={`Gobierno contra el valor original de Privada, que queda guardado como respaldo. Privada adopta el dato de Gobierno; si Gobierno no lo tiene, se usa el de Privada. Leído ${fmtFecha(cruce.leido_en)}.`}
    >
      <div className="grid gap-3 md:grid-cols-2 mb-3">
        {Object.entries(cruce.por_campo).map(([campo, conteo]) => (
          <table key={campo} className="w-full text-sm">
            <caption className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 pb-1">{campo === 'intendente' ? 'Intendente' : 'Partido'}</caption>
            <tbody>
              {Object.entries(conteo).map(([estado, n]) => (
                <tr key={estado} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 text-gov-navy">{ESTADOS[estado] ?? estado}</td>
                  <td className="py-1 text-right tabular-nums">{fmtN(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <Tabla columnas={COL_CRUCE} filas={cruce.diferencias} archivo="cruce_padron_gobierno_privada.xlsx" />
    </Panel>
  )
}

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
      {d.cruce && <Cruce cruce={d.cruce} />}
      <Aviso>Legisladores: no están en ninguna planilla compartida. Se los pedimos al área.</Aviso>
      <Fuente>planilla "1. REGISTRO REUNIONES" de Gobierno, pestaña Intendentes (sincronizada a diario).</Fuente>
    </div>
  )
}
