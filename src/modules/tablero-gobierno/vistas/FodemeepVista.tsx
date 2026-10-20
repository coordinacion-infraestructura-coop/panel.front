import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type FodemeepLocalidad } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SerieComparada, Tabla, type Columna } from '../components/Bloques'
import { MESES, fmtMonto, fmtN, fmtPct, fmtPeriodo } from '../formato'
import type { ContextoTablero } from './contexto'

const COLOR_ESTADO: Record<string, string> = { NORMAL: '#2e8b57', SUSPENDIDO: '#c98a12', CORTADO: '#c0392b', 'NO ADHERIDO': '#9db0c1', 'SIN DATO': '#d5dde5' }

const CLS_ESTADO: Record<string, string> = {
  NORMAL: 'bg-emerald-50 text-emerald-700',
  SUSPENDIDO: 'bg-amber-50 text-amber-700',
  CORTADO: 'bg-red-50 text-red-700',
}

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** FODEMEEP (Etapa 2): planilla "11.1 FODEMEP", pestañas FODEMEP y ESTADO. "Retenido" es la
 * columna ACUMULADO de la planilla; su significado está pendiente de confirmar con el área
 * (spec-datos-externos-fase2-transferencias.md §8.1). */
export function FodemeepVista({ ctx }: { ctx: ContextoTablero }) {
  const q = useQuery({ queryKey: ['tablero-gobierno', 'fodemeep', ctx.anio, ctx.codigos], queryFn: () => tableroApi.fodemeep(ctx.anio, ctx.codigos) })
  const series = useMemo(
    () =>
      q.data
        ? [
            { nombre: 'Transferido', valores: q.data.mensual_transferido, color: '#2e8b57' },
            { nombre: 'Retenido (según planilla)', valores: q.data.mensual_retenido, color: '#e8a0a0' },
          ]
        : [],
    [q.data],
  )
  const pie = useMemo(() => {
    const d = q.data
    if (!d) return undefined
    return (i: number) => {
      const t = d.mensual_transferido[i] ?? 0
      const r = d.mensual_retenido[i] ?? 0
      return t + r ? `${fmtPct(t / (t + r))} transferido` : undefined
    }
  }, [q.data])
  const columnas = useMemo<Columna<FodemeepLocalidad>[]>(() => {
    const d = q.data
    const conDato = d ? MESES.map((_, i) => i).filter((i) => d.mensual_transferido[i] != null) : []
    return [
      { titulo: 'Departamento', valor: (f) => f.departamento },
      { titulo: 'Localidad', valor: (f) => f.localidad },
      {
        titulo: 'Estado',
        valor: (f) => f.estado,
        render: (f) =>
          f.estado ? <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${CLS_ESTADO[f.estado] ?? 'bg-slate-100 text-slate-600'}`}>{capital(f.estado)}</span> : '—',
      },
      ...conDato.map<Columna<FodemeepLocalidad>>((i) => ({
        titulo: MESES[i],
        valor: (f) => f.meses[i],
        render: (f) => fmtMonto(f.meses[i]),
        numerica: true,
      })),
      { titulo: 'Total', valor: (f) => f.total, render: (f) => fmtMonto(f.total), numerica: true },
    ]
  }, [q.data])

  if (q.isError) return <Aviso tono="error">No pudimos cargar FODEMEEP. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const k = d.kpis
  if (!k.ultimo_periodo) return <Aviso tono="warn">Todavía no hay datos sincronizados de la planilla de FODEMEEP.</Aviso>
  const transferidoAnio = d.mensual_transferido.reduce<number>((a, v) => a + (v ?? 0), 0)
  const retenidoUltimo = k.retenido_ultimo ?? 0
  const totalCols = columnas.length

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Localidades con FODEMEEP" valor={fmtN(k.localidades)} />
        <Kpi label="Presupuestado en la gestión" valor={fmtMonto(k.presupuestado_gestion)} detalle="desde octubre de 2023" />
        <Kpi label="Transferido en la gestión" valor={fmtMonto(k.transferido_gestion)} />
        <Kpi label="Transferido (último mes)" valor={fmtMonto(k.transferido_ultimo)} detalle={`${fmtPeriodo(k.ultimo_periodo)} · presupuestado ${fmtMonto(k.presupuestado_ultimo)}`} />
        <Kpi label="Retenido (último mes)" valor={fmtMonto(retenidoUltimo)} detalle="columna ACUMULADO de la planilla" />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          titulo="Neto a transferir por mes"
          ayuda={`${d.anio}. En verde lo transferido; en rojo lo retenido a localidades suspendidas o cortadas, según la planilla. El tooltip muestra el % transferido.`}
        >
          <SerieComparada labels={MESES} series={series} formato={fmtMonto} apiladas pie={pie} ariaLabel="Transferido y retenido por mes" />
        </Panel>
        <Panel titulo="Estado de adhesión" ayuda="Localidades por estado, hoy.">
          <DonutChart
            labels={d.estados.map((e) => `${capital(e.estado)} (${e.cantidad})`)}
            values={d.estados.map((e) => e.cantidad)}
            colors={d.estados.map((e) => COLOR_ESTADO[e.estado] ?? '#9db0c1')}
            height={240}
          />
        </Panel>
      </div>

      <Panel titulo="Neto a transferir por localidad y mes" ayuda={`${d.anio}. Las no adheridas, y las cortadas desde el corte, quedan en 0.`}>
        <Tabla
          columnas={columnas}
          filas={d.por_localidad}
          archivo={`fodemeep_${d.anio}.xlsx`}
          total={[
            'Total', '', '',
            ...MESES.map((_, i) => i).filter((i) => d.mensual_transferido[i] != null).map((i) => fmtMonto(d.mensual_transferido[i])),
            fmtMonto(transferidoAnio),
          ].slice(0, totalCols)}
        />
      </Panel>

      <Aviso>Qué significa exactamente la columna ACUMULADO (lo "retenido") está pendiente de confirmar con el área.</Aviso>
      <Fuente>planilla "11.1 FODEMEP" de Gobierno, pestañas FODEMEP y ESTADO (sincronizada a diario).</Fuente>
    </div>
  )
}
