import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type ObraFila } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtFecha, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const capital = (s: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '—')

const comunes: Columna<ObraFila>[] = [
  { titulo: 'Obra', valor: (f) => f.nombre, render: (f) => <span className="inline-block max-w-[320px] truncate align-bottom" title={f.nombre ?? ''}>{f.nombre ?? '—'}</span> },
  { titulo: 'División', valor: (f) => f.division },
  { titulo: 'Estado', valor: (f) => f.estado, render: (f) => capital(f.estado) },
  { titulo: 'Inicio', valor: (f) => f.fecha_inicio, render: (f) => fmtFecha(f.fecha_inicio) },
  { titulo: 'Fin', valor: (f) => f.fecha_fin, render: (f) => fmtFecha(f.fecha_fin) },
  { titulo: 'Avance', valor: (f) => f.avance, render: (f) => fmtPct(f.avance), numerica: true },
]
const COL_UN_DEPTO: Columna<ObraFila>[] = [{ titulo: 'Departamento', valor: (f) => f.departamentos[0] ?? null }, ...comunes]
const COL_VARIOS: Columna<ObraFila>[] = [{ titulo: 'Departamentos', valor: (f) => f.departamentos.join(', ') }, ...comunes]
const COL_LOCALIDAD: Columna<ObraFila>[] = [
  { titulo: 'Localidades', valor: (f) => f.localidades.map((l) => l.nombre).join(', '), render: (f) => <span className="inline-block max-w-[260px] truncate align-bottom" title={f.localidades.map((l) => l.nombre).join(', ')}>{f.localidades.map((l) => l.nombre).join(', ') || '—'}</span> },
  { titulo: 'Departamento', valor: (f) => f.departamentos.join(', ') },
  ...comunes,
]
const COL_PROVINCIALES: Columna<ObraFila>[] = comunes

type Nivel = 'departamento' | 'localidad'

/** Obras (Etapa 5): planilla "12. Obras", pestaña BD-TABLERO. Sin montos hasta que el área
 * confirme la moneda (spec-datos-externos-fase5-gestion-territorial.md §0). */
export function ObrasVista({ ctx }: { ctx: ContextoTablero }) {
  const [nivelElegido, setNivel] = useState<Nivel>('departamento')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'obras', ctx.codigos], queryFn: () => tableroApi.obras(ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar las obras. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.obras.length) return <Aviso tono="warn">{ctx.codigos ? 'No hay obras para este filtro.' : 'Todavía no hay datos sincronizados de la planilla de obras.'}</Aviso>
  const k = d.kpis
  // Con una localidad elegida en el filtro se fuerza el nivel localidad (spec del panel §2.5 #2).
  const nivel: Nivel = ctx.localidad ? 'localidad' : nivelElegido
  const provinciales = d.obras.filter((o) => o.ambito === 'PROVINCIAL')
  const territoriales = d.obras.filter((o) => o.ambito !== 'PROVINCIAL')

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Obras" valor={fmtN(k.obras)} detalle={`en ${fmtN(k.localidades)} localidades`} />
        <Kpi label="En ejecución" valor={fmtN(k.en_ejecucion)} />
        <Kpi label="Finalizadas" valor={fmtN(k.finalizadas)} />
        <Kpi label="A ejecutar" valor={fmtN(k.a_ejecutar)} detalle="en proyecto, a licitar o en licitación" />
        <Kpi label="Avance promedio" valor={fmtPct(k.avance_promedio)} detalle="de las obras con avance cargado" />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Por estado">
          <BarChart labels={d.por_estado.map((e) => capital(e.clave))} values={d.por_estado.map((e) => e.cantidad)} horizontal height={Math.max(180, d.por_estado.length * 26)} />
        </Panel>
        <Panel titulo="Por división">
          <BarChart labels={d.por_division.map((e) => e.clave)} values={d.por_division.map((e) => e.cantidad)} horizontal height={Math.max(180, d.por_division.length * 26)} />
        </Panel>
      </div>

      <Panel
        titulo="Obras"
        ayuda={nivel === 'departamento' ? 'Como el Looker: obras de un solo departamento y de varios.' : 'Obras de una sola localidad y de varias.'}
        extra={
          !ctx.localidad && (
            <div className="inline-flex border border-slate-200 rounded-md overflow-hidden" role="group" aria-label="Nivel de las tablas">
              {(['departamento', 'localidad'] as Nivel[]).map((n) => (
                <button key={n} type="button" aria-pressed={nivel === n} onClick={() => setNivel(n)}
                  className={`text-xs px-2.5 py-1.5 ${nivel === n ? 'bg-slate-100 font-semibold text-gov-navy' : 'text-gray-500'}`}>
                  Por {n}
                </button>
              ))}
            </div>
          )
        }
      >
        {nivel === 'departamento' ? (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Obras que abarcan un solo departamento</h4>
            <Tabla columnas={COL_UN_DEPTO} filas={territoriales.filter((o) => o.departamentos.length === 1)} archivo="obras_un_departamento.xlsx" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Obras que abarcan varios departamentos</h4>
            <Tabla columnas={COL_VARIOS} filas={territoriales.filter((o) => o.departamentos.length > 1)} archivo="obras_varios_departamentos.xlsx" />
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Obras de una sola localidad</h4>
            <Tabla columnas={COL_LOCALIDAD} filas={territoriales.filter((o) => o.localidades.length === 1)} archivo="obras_una_localidad.xlsx" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Obras de varias localidades</h4>
            <Tabla columnas={COL_LOCALIDAD} filas={territoriales.filter((o) => o.localidades.length > 1)} archivo="obras_varias_localidades.xlsx" />
          </div>
        )}
      </Panel>

      {!ctx.codigos && (
        <Panel titulo="Obras generales" ayuda="Obras provinciales, sin una localidad o departamento.">
          <Tabla columnas={COL_PROVINCIALES} filas={provinciales} archivo="obras_generales.xlsx" />
        </Panel>
      )}

      <Aviso>
        Sin montos: la planilla los rotula en millones de dólares, pero no cierran con esa moneda. Le preguntamos al área antes de mostrarlos.
      </Aviso>
      <Fuente>planilla "12. Obras" de Gobierno, pestaña BD-TABLERO (sincronizada a diario).</Fuente>
    </div>
  )
}
