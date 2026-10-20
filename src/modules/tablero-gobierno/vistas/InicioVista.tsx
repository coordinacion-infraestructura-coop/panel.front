import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CoropletiqueDepartamentos } from '../../../shared/components/informe/CoropletiqueDepartamentos'
import { normalizeDepartamento } from '../../../shared/utils/normalizeName'
import { tableroApi } from '../api/tablero.api'
import { Aviso, Cargando, Kpi, Kpis, Panel } from '../components/Bloques'
import { fmtMonto, fmtN, fmtPct, fmtPeriodo, fmtPesos } from '../formato'
import type { ContextoTablero } from './contexto'

type Metrica = 'por_habitante' | 'transferido' | 'atp'

const METRICAS: Record<Metrica, { nombre: string; formato: (v: number) => string }> = {
  por_habitante: { nombre: 'Transferido por habitante', formato: (v) => fmtPesos(v) },
  transferido: { nombre: 'Transferido', formato: (v) => fmtMonto(v) },
  atp: { nombre: 'ATP comprometido', formato: (v) => fmtMonto(v) },
}

/** Inicio (Etapa 1): lo que ya tenemos — nomenclador, Censo, transferencias de Transparencia
 * y ATP Compromisos. Visitas, convenios y "Para mirar" llegan con la Etapa 5. */
export function InicioVista({ ctx }: { ctx: ContextoTablero }) {
  const [metrica, setMetrica] = useState<Metrica>('por_habitante')
  const inicio = useQuery({ queryKey: ['tablero-gobierno', 'inicio', ctx.anio, ctx.codigos], queryFn: () => tableroApi.inicio(ctx.anio, ctx.codigos) })
  const atp = useQuery({ queryKey: ['tablero-gobierno', 'atp', ctx.idsGeo], queryFn: () => tableroApi.atpCompromisos(ctx.idsGeo) })
  // El mapa muestra siempre la provincia entera (resaltando el departamento elegido).
  const provincia = useQuery({ queryKey: ['tablero-gobierno', 'inicio', ctx.anio, undefined], queryFn: () => tableroApi.inicio(ctx.anio), enabled: !!ctx.codigos })
  const atpProvincia = useQuery({ queryKey: ['tablero-gobierno', 'atp', undefined], queryFn: () => tableroApi.atpCompromisos(), enabled: !!ctx.idsGeo })

  if (inicio.isError) return <Aviso tono="error">No pudimos cargar el inicio del tablero. Probá de nuevo en un rato.</Aviso>
  if (!inicio.data) return <Cargando />
  const k = inicio.data.kpis
  const deptos = (ctx.codigos ? provincia.data : inicio.data)?.por_departamento ?? []
  const atpDeptos = (ctx.idsGeo ? atpProvincia.data : atp.data)?.por_departamento ?? []
  const atpPorDepto = new Map(atpDeptos.map((g) => [normalizeDepartamento(g.clave), g.monto]))
  const datosMapa = deptos.map((d) => ({
    departamento: d.departamento,
    por_habitante: d.por_habitante ?? 0,
    transferido: d.transferido,
    atp: atpPorDepto.get(normalizeDepartamento(d.departamento)) ?? 0,
  }))
  const a = atp.data?.kpis
  const tarjetas: [string, string, string, string, string?][] = [
    ['Transferencias', `Automáticas en ${ctx.anio}`, fmtMonto(k.transferido), 'transferencias', 'coparticipacion'],
    ['Fondos y aportes', 'Compromisos del Gobernador', a ? fmtMonto(a.monto) : '…', 'fondos', 'atp-compromisos'],
    ['Gestión territorial', 'Obras, visitas, convenios', 'Etapa 5', 'gestion'],
    ['Expedientes', 'Expedientes visados', 'a definir', 'expedientes'],
  ]

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Localidades" valor={fmtN(k.localidades)} detalle={`${fmtN(k.municipios)} municipios · ${fmtN(k.comunas)} comunas`} />
        <Kpi label="Población 2022" valor={fmtN(k.poblacion)} detalle="Censo INDEC" />
        <Kpi
          label={`Transferido en ${ctx.anio}`}
          valor={fmtMonto(k.transferido)}
          detalle={`${fmtPesos(k.por_habitante)} por habitante · hasta ${fmtPeriodo(inicio.data.periodo_hasta)}`}
        />
        <Kpi
          label="Compromisos del Gobernador"
          valor={a ? fmtMonto(a.monto) : atp.isError ? '—' : '…'}
          detalle={a ? <><span className="text-emerald-700 font-semibold">{fmtPct(a.monto ? a.pagado / a.monto : null)}</span> pagado · {fmtN(a.compromisos)} compromisos</> : undefined}
        />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          titulo="Mapa por departamento"
          ayuda={`${METRICAS[metrica].nombre}${metrica === 'atp' ? ' (toda la gestión)' : ` · ${ctx.anio}`}. Clic en un departamento para filtrar.`}
          extra={
            <div className="inline-flex border border-slate-200 rounded-md overflow-hidden" role="group" aria-label="Indicador del mapa">
              {(Object.keys(METRICAS) as Metrica[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metrica === m}
                  onClick={() => setMetrica(m)}
                  className={`text-xs px-2.5 py-1.5 ${metrica === m ? 'bg-slate-100 font-semibold text-gov-navy' : 'text-gray-500'}`}
                >
                  {METRICAS[m].nombre}
                </button>
              ))}
            </div>
          }
        >
          <CoropletiqueDepartamentos
            data={datosMapa}
            metrica={metrica}
            label={METRICAS[metrica].nombre}
            formatValor={METRICAS[metrica].formato}
            seleccionado={ctx.departamento || null}
            onDepartamentoClick={(nombre) => {
              const d = deptos.find((x) => normalizeDepartamento(x.departamento) === normalizeDepartamento(nombre))
              if (d) ctx.setDepartamento(d.departamento === ctx.departamento ? '' : d.departamento)
            }}
            height={420}
          />
        </Panel>
        <div className="flex flex-col gap-3 min-w-0">
          {tarjetas.map(([t, sub, v, sec, s]) => (
            <button
              key={t}
              type="button"
              onClick={() => ctx.irA(sec, s)}
              className="text-left bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-gov-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
            >
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">{t}</span>
              <span className="block text-xs text-gray-500">{sub}</span>
              <span className="block text-lg font-bold text-gov-navy tabular-nums">{v}</span>
              <span className="block text-xs font-semibold text-gov-blue">Ver sección →</span>
            </button>
          ))}
        </div>
      </div>

      <Aviso>
        Las visitas, los convenios y los cruces de "Para mirar" se suman en la Etapa 5, cuando estén conectadas las planillas de recorridos y convenios.
      </Aviso>
    </div>
  )
}
