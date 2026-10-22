import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import {
  tableroApi,
  type DiferenciaPlanilla,
  type EleccionDepartamento,
  type EleccionLocalidad,
  type EleccionResultado,
  type MunicipalFila,
  type VariacionFila,
} from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtFecha, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const COLOR_FUERZA: Record<string, string> = {
  LLA: '#7b4fa8', PU: '#01aae3', HxC: '#398ebd', JxC: '#c98a12', DC: '#2e8b57', FP: '#4a6fa5', FdT: '#4a6fa5', UxP: '#4a6fa5', UCR: '#b0413e',
}
const OTRO = '#c9d6e2'
const color = (f: string | null) => (f ? COLOR_FUERZA[f] ?? '#8aa0b4' : OTRO)
/** Diferencia en puntos porcentuales. */
const fmtPp = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pp`

const podio = <T extends { ganador: string | null; ganador_pct: number | null; segundo: string | null; segundo_pct: number | null; margen: number | null }>(): Columna<T>[] => [
  { titulo: 'Ganador', valor: (f) => f.ganador, render: (f) => <span style={{ color: color(f.ganador) }} className="font-semibold">{f.ganador ?? '—'}</span> },
  { titulo: '% ganador', valor: (f) => f.ganador_pct, render: (f) => fmtPct(f.ganador_pct), numerica: true },
  { titulo: 'Segundo', valor: (f) => f.segundo },
  { titulo: '% segundo', valor: (f) => f.segundo_pct, render: (f) => fmtPct(f.segundo_pct), numerica: true },
  { titulo: 'Margen', valor: (f) => f.margen, render: (f) => fmtPp(f.margen), numerica: true },
]

const COL_DEPTOS: Columna<EleccionDepartamento>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Padrón', valor: (f) => f.padron, render: (f) => fmtN(f.padron), numerica: true },
  { titulo: 'Participación', valor: (f) => f.participacion, render: (f) => fmtPct(f.participacion), numerica: true },
  { titulo: 'Afirmativos', valor: (f) => f.afirmativos, render: (f) => fmtN(f.afirmativos), numerica: true },
  ...podio<EleccionDepartamento>(),
]

function columnasLocalidad(e: EleccionResultado): Columna<EleccionLocalidad>[] {
  const conVotos = e.fuente === 'circuitos'
  return [
    { titulo: 'Departamento', valor: (f) => f.departamento },
    { titulo: 'Localidad', valor: (f) => f.localidad },
    ...(conVotos
      ? [
          ...(e.padron != null ? [{ titulo: 'Padrón', valor: (f: EleccionLocalidad) => f.padron, render: (f: EleccionLocalidad) => fmtN(f.padron), numerica: true }] : []),
          { titulo: 'Afirmativos', valor: (f: EleccionLocalidad) => f.afirmativos, render: (f: EleccionLocalidad) => fmtN(f.afirmativos), numerica: true },
        ]
      : []),
    ...podio<EleccionLocalidad>(),
    ...[...e.principales, 'Otras'].map((fz) => ({
      titulo: `% ${fz}`,
      valor: (f: EleccionLocalidad) => f.pct[fz] ?? null,
      render: (f: EleccionLocalidad) => fmtPct(f.pct[fz]),
      numerica: true,
    })),
  ]
}

const COL_MUNICIPALES: Columna<MunicipalFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Tipo', valor: (f) => f.tipo_gobierno },
  { titulo: 'Fecha', valor: (f) => f.fecha, render: (f) => fmtFecha(f.fecha) },
  { titulo: 'Ganador', valor: (f) => f.ganador_partido },
  { titulo: 'Lista', valor: (f) => f.ganador_lista, render: (f) => <span className="inline-block max-w-[220px] truncate align-bottom" title={f.ganador_lista ?? ''}>{f.ganador_lista ?? '—'}</span> },
  { titulo: 'Electo', valor: (f) => f.ganador_nombre },
  { titulo: '% ganador', valor: (f) => f.ganador_pct, render: (f) => fmtPct(f.ganador_pct), numerica: true },
  { titulo: 'Segundo', valor: (f) => f.segundo_partido },
  { titulo: 'Candidato segundo', valor: (f) => f.segundo_nombre },
  { titulo: '% segundo', valor: (f) => f.segundo_pct, render: (f) => fmtPct(f.segundo_pct), numerica: true },
  { titulo: 'Margen', valor: (f) => f.margen, render: (f) => fmtPp(f.margen), numerica: true },
  { titulo: 'Participación', valor: (f) => f.participacion, render: (f) => fmtPct(f.participacion), numerica: true },
]

const COL_VARIACION: Columna<VariacionFila>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'LLA 2023', valor: (f) => f.lla_2023, render: (f) => fmtPct(f.lla_2023), numerica: true },
  { titulo: 'LLA 2025', valor: (f) => f.lla_2025, render: (f) => fmtPct(f.lla_2025), numerica: true },
  { titulo: 'Variación LLA', valor: (f) => f.variacion_lla, render: (f) => fmtPp(f.variacion_lla), numerica: true },
  { titulo: 'HxC 2023', valor: (f) => f.hxc_2023, render: (f) => fmtPct(f.hxc_2023), numerica: true },
  { titulo: 'PU 2025', valor: (f) => f.pu_2025, render: (f) => fmtPct(f.pu_2025), numerica: true },
  { titulo: 'PU 2025 vs HxC 2023', valor: (f) => f.variacion_pu_hxc, render: (f) => fmtPp(f.variacion_pu_hxc), numerica: true },
]

const COL_DIFERENCIAS: Columna<DiferenciaPlanilla>[] = [
  { titulo: 'Pestaña', valor: (f) => f.pestana },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Dato', valor: (f) => f.campo },
  { titulo: 'En la planilla', valor: (f) => f.planilla, numerica: true },
  { titulo: 'Recalculado', valor: (f) => f.calculado, numerica: true },
]

/** Elecciones (Etapa 6, solo Admin y Autoridad): planilla "18. Resultados elecciones 21-25".
 * Votos, porcentajes, ganador y margen se recalculan desde los circuitos; gobernador 2023 viene
 * pegado en la planilla (no hay base). Las diferencias con lo pegado se listan al final. */
export function EleccionesVista({ ctx }: { ctx: ContextoTablero }) {
  const [elegida, setElegida] = useState('')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'elecciones', ctx.codigos], queryFn: () => tableroApi.elecciones(ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar los resultados electorales. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.elecciones.length) return <Aviso tono="warn">Todavía no hay datos sincronizados de la planilla de elecciones.</Aviso>
  const e = d.elecciones.find((x) => x.eleccion === elegida) ?? d.elecciones[0]
  const ganador = e.fuerzas.find((f) => f.fuerza !== 'Otros')
  const fuerzas = e.fuerzas.slice(0, 10)
  const m = d.municipales

  return (
    <div className="space-y-4">
      <Panel titulo="Elección">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elección">
          {d.elecciones.map((x) => (
            <button
              key={x.eleccion}
              type="button"
              aria-pressed={x.eleccion === e.eleccion}
              onClick={() => setElegida(x.eleccion)}
              className={`text-xs px-3 py-1.5 rounded-md border ${x.eleccion === e.eleccion ? 'bg-gov-navy text-white border-gov-navy' : 'border-slate-300 text-gray-600 hover:border-gov-blue'}`}
            >
              {x.titulo}
            </button>
          ))}
        </div>
      </Panel>

      {e.fuente === 'copia' && (
        <Aviso>
          Gobernador 2023: la planilla trae solo porcentajes por localidad, sin votos. No hay total provincial ni por departamento; se muestra tal cual,
          controlando que cada localidad sume 100 %.
        </Aviso>
      )}

      <Kpis>
        {e.padron != null && <Kpi label="Padrón" valor={fmtN(e.padron)} />}
        {e.participacion != null && <Kpi label="Participación" valor={fmtPct(e.participacion)} />}
        {e.afirmativos != null && <Kpi label="Votos afirmativos" valor={fmtN(e.afirmativos)} />}
        {ganador && <Kpi label="Fuerza más votada" valor={ganador.fuerza} detalle={fmtPct(ganador.pct)} />}
        {e.localidades_ganadas.slice(0, 3).map((c) => (
          <Kpi key={c.clave} label={`Localidades ganadas · ${c.clave}`} valor={fmtN(c.cantidad)} detalle={`de ${fmtN(e.por_localidad.length)}`} />
        ))}
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-2">
        {fuerzas.length > 0 && (
          <Panel titulo="Por fuerza" ayuda="Porcentaje sobre votos afirmativos.">
            <BarChart
              labels={fuerzas.map((f) => f.fuerza)}
              values={fuerzas.map((f) => Math.round((f.pct ?? 0) * 1000) / 10)}
              colors={fuerzas.map((f) => color(f.fuerza === 'Otros' ? null : f.fuerza))}
              horizontal
              height={Math.max(220, fuerzas.length * 24)}
            />
          </Panel>
        )}
        <Panel titulo="Localidades ganadas" ayuda="Ganador sobre todas las fuerzas.">
          <DonutChart
            labels={e.localidades_ganadas.map((c) => `${c.clave} (${c.cantidad})`)}
            values={e.localidades_ganadas.map((c) => c.cantidad)}
            colors={e.localidades_ganadas.map((c) => color(c.clave))}
            height={240}
          />
        </Panel>
      </div>

      {e.por_departamento.length > 0 && (
        <Panel titulo="Por departamento">
          <Tabla columnas={COL_DEPTOS} filas={e.por_departamento} archivo={`${e.eleccion}_departamentos.xlsx`} />
        </Panel>
      )}
      <Panel titulo="Por localidad" ayuda="Margen: diferencia en puntos porcentuales entre el ganador y el segundo.">
        <Tabla columnas={columnasLocalidad(e)} filas={e.por_localidad} archivo={`${e.eleccion}_localidades.xlsx`} />
      </Panel>
      {e.fuente === 'circuitos' && d.circuitos_sin_localidad > 0 && (
        <p className="text-xs text-gray-500">
          {fmtN(d.circuitos_sin_localidad)} circuitos rurales no tienen gobierno local: cuentan en el total provincial y en su departamento, no en
          ninguna localidad.
        </p>
      )}

      {m && (
        <Panel titulo="Elecciones municipales 2023" ayuda={m.sin_votos ? `${fmtN(m.sin_votos)} localidades sin votos cargados en la planilla.` : undefined}>
          <div className="mb-3">
            <Kpis>
              {m.localidades_ganadas.slice(0, 5).map((c) => (
                <Kpi key={c.clave} label={c.clave} valor={fmtN(c.cantidad)} detalle="gobiernos locales" />
              ))}
            </Kpis>
          </div>
          <Tabla columnas={COL_MUNICIPALES} filas={m.por_localidad} archivo="municipales_2023.xlsx" />
        </Panel>
      )}

      {d.variacion.length > 0 && (
        <Panel titulo="Variación 2023 → 2025" ayuda="Diputados nacionales, en puntos porcentuales.">
          <Tabla columnas={COL_VARIACION} filas={d.variacion} archivo="variacion_2023_2025.xlsx" />
        </Panel>
      )}

      <Panel
        titulo="Diferencias con la planilla"
        ayuda="Valores pegados en la planilla que no coinciden con el recálculo desde los votos por circuito. En pantalla se muestra el recalculado; la lista se informa al área."
      >
        {d.diferencias.length ? (
          <Tabla columnas={COL_DIFERENCIAS} filas={d.diferencias} archivo="diferencias_planilla_elecciones.xlsx" />
        ) : (
          <p className="text-sm text-gray-600">Sin diferencias.</p>
        )}
      </Panel>
      <Fuente>planilla "18. Resultados elecciones 21-25" de Gobierno (sincronizada a diario).</Fuente>
    </div>
  )
}
