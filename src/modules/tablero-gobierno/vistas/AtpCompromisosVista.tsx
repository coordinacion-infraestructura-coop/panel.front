import { useQuery } from '@tanstack/react-query'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type AtpFila } from '../api/tablero.api'
import { Aviso, Cargando, EstadoPill, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtFecha, fmtMonto, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const COLOR_ESTADO: Record<string, string> = { Pagado: '#2e8b57', Parcial: '#01aae3', Pendiente: '#c98a12', 'Sin dato': '#9db0c1' }

const COLUMNAS: Columna<AtpFila>[] = [
  { titulo: 'Anuncio', valor: (f) => f.fecha_anuncio, render: (f) => fmtFecha(f.fecha_anuncio) },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Destino', valor: (f) => f.destino, render: (f) => <span className="inline-block max-w-[280px] truncate align-bottom" title={f.destino ?? ''}>{f.destino ?? '—'}</span> },
  { titulo: 'Ministerio', valor: (f) => f.ministerio },
  { titulo: 'Expediente', valor: (f) => f.nro_expediente },
  { titulo: 'Monto', valor: (f) => f.monto, render: (f) => fmtMonto(f.monto), numerica: true },
  { titulo: 'Pagado', valor: (f) => f.pagado, render: (f) => fmtMonto(f.pagado), numerica: true },
  { titulo: 'Estado', valor: (f) => f.estado, render: (f) => <EstadoPill estado={f.estado} /> },
]

/** ATP Compromisos del Gobernador (Etapa 1). Nunca se suma con ATP Interno: hay pagos
 * cargados en las dos planillas (ADR-029). */
export function AtpCompromisosVista({ ctx }: { ctx: ContextoTablero }) {
  const q = useQuery({ queryKey: ['tablero-gobierno', 'atp', ctx.idsGeo], queryFn: () => tableroApi.atpCompromisos(ctx.idsGeo) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar los compromisos. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  const k = d.kpis
  const ministerios = d.por_ministerio.slice(0, 10)

  return (
    <div className="space-y-4">
      {d.estado_sincronizacion !== 'ok' && (
        <Aviso tono="warn">
          {d.estado_sincronizacion === 'sin_datos'
            ? 'Todavía no hay datos sincronizados de la planilla.'
            : d.estado_sincronizacion === 'en_curso'
              ? 'La planilla se está sincronizando en este momento.'
              : 'La última sincronización de la planilla tuvo filas con error.'}
        </Aviso>
      )}
      {ctx.codigos && k.compromisos === 0 && (
        <Aviso>
          No hay compromisos del Gobernador para este filtro. Los pagos de ATP (la página "ATP" del Looker) están en{' '}
          <button type="button" onClick={() => ctx.irA('fondos', 'atp-interno')} className="font-semibold text-gov-blue underline">
            ATP Interno
          </button>
          .
        </Aviso>
      )}
      <Kpis>
        <Kpi label="Localidades con compromisos" valor={fmtN(k.localidades)} />
        <Kpi label="Compromisos" valor={fmtN(k.compromisos)} detalle={k.derivados ? `${fmtN(k.derivados)} derivados` : undefined} />
        <Kpi label="Monto comprometido" valor={fmtMonto(k.monto)} />
        <Kpi label="Pagado" valor={fmtMonto(k.pagado)} detalle={<span className="text-emerald-700 font-semibold">{fmtPct(k.monto ? k.pagado / k.monto : null)}</span>} />
        <Kpi label="Saldo" valor={fmtMonto(k.saldo)} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel titulo="Por ministerio" ayuda="Monto comprometido, en millones (los 10 mayores).">
          <BarChart
            labels={ministerios.map((m) => m.clave)}
            values={ministerios.map((m) => m.monto / 1e6)}
            horizontal
            height={Math.max(180, ministerios.length * 34)}
            tooltipSuffix=" M"
          />
        </Panel>
        <Panel titulo="Estado de pago" ayuda="Cantidad de compromisos. Pagado: el cronograma cubre el monto; parcial: cubre una parte.">
          <DonutChart
            labels={d.por_estado.map((e) => `${e.clave} (${e.cantidad})`)}
            values={d.por_estado.map((e) => e.cantidad)}
            colors={d.por_estado.map((e) => COLOR_ESTADO[e.clave] ?? '#9db0c1')}
            height={240}
          />
        </Panel>
      </div>

      <Panel titulo="Compromisos" ayuda="Los más recientes primero. El año del filtro no se aplica: son compromisos de toda la gestión.">
        <Tabla columnas={COLUMNAS} filas={d.filas} archivo="atp_compromisos.xlsx" total={['Total', '', '', '', '', '', fmtMonto(k.monto), fmtMonto(k.pagado), '']} />
      </Panel>

      <Aviso>ATP Compromisos y ATP Interno se muestran por separado y nunca se suman: hay pagos cargados en las dos planillas.</Aviso>
      <Fuente>
        planilla "ATP - Compromiso Gobernador" (sincronizada cada hora en svc-gralgob)
        {d.ultima_sincronizacion && ` · última sincronización ${new Date(d.ultima_sincronizacion).toLocaleString('es-AR')}`}.
      </Fuente>
    </div>
  )
}
