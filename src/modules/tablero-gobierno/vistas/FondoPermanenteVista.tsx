import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type FpermLocalidad, type FpermPrestamo } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, Velocimetro, type Columna } from '../components/Bloques'
import { MESES, fmtFecha, fmtMonto, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

/** `[54, 55]` → "54 a 55"; `[50, 52, 53]` → "50, 52, 53". */
function rangoEtapas(etapas: number[]): string {
  if (!etapas.length) return '—'
  const seguidas = etapas.every((e, i) => i === 0 || e === etapas[i - 1] + 1)
  if (etapas.length === 1) return String(etapas[0])
  return seguidas ? `${etapas[0]} a ${etapas[etapas.length - 1]}` : etapas.join(', ')
}

const COL_PRESTAMOS: Columna<FpermPrestamo>[] = [
  { titulo: 'Fecha', valor: (f) => f.fecha, render: (f) => (f.fecha ? fmtFecha(f.fecha) : <span className="text-sky-700 font-semibold">Listo para pagar</span>) },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad ?? 'Sin código en la planilla' },
  { titulo: 'Etapas', valor: (f) => f.etapas },
  { titulo: 'Monto', valor: (f) => f.monto_total, render: (f) => fmtMonto(f.monto_total), numerica: true },
  { titulo: 'Cuota', valor: (f) => f.cuota, render: (f) => fmtMonto(f.cuota), numerica: true },
  { titulo: 'Plazo', valor: (f) => f.plazo, render: (f) => (f.plazo ? `${f.plazo} meses` : '—'), numerica: true },
  { titulo: 'Descuento desde', valor: (f) => f.mes_inicio_descuento, render: (f) => (f.mes_inicio_descuento ? MESES[f.mes_inicio_descuento - 1] : '—') },
  { titulo: 'Destino', valor: (f) => f.destino, render: (f) => <span className="inline-block max-w-[280px] truncate align-bottom" title={f.destino ?? ''}>{f.destino ?? '—'}</span> },
  { titulo: 'Ord./Res.', valor: (f) => f.ord_res },
]

const COL_LOCALIDADES: Columna<FpermLocalidad>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Última etapa recibida', valor: (f) => f.ultima_etapa, numerica: true },
  { titulo: 'Recibió la última', valor: (f) => (f.recibio_ultima ? 'Sí' : 'No') },
  { titulo: 'Recibió la anteúltima', valor: (f) => (f.recibio_anteultima ? 'Sí' : 'No') },
  { titulo: 'Etapas disponibles', valor: (f) => rangoEtapas(f.etapas_disponibles) },
  { titulo: 'Disponible', valor: (f) => f.disponible, render: (f) => fmtMonto(f.disponible), numerica: true },
]

/** Fondo Permanente (Etapa 3): planilla "7. FONDO PERMANENTE". Las etapas y el saldo son una foto
 * de hoy; los préstamos tienen su propio filtro de año (spec-datos-externos-fase3-fondos.md §4). */
export function FondoPermanenteVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'fondo-permanente', ctx.codigos], queryFn: () => tableroApi.fondoPermanente(ctx.anio, ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar el Fondo Permanente. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.localidades_adheridas) return <Aviso tono="warn">Todavía no hay datos sincronizados de la planilla del Fondo Permanente.</Aviso>
  const delAnio = anio === 'gestion' ? undefined : d.por_anio.find((a) => a.anio === anio)
  const otorgado = delAnio ? delAnio.otorgado : d.gestion
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const prestamos = anio === 'gestion' ? d.prestamos : d.prestamos.filter((p) => p.anio === anio)
  const porAnio = [...d.por_anio].reverse()
  const pct = (n: number) => (d.localidades_adheridas ? n / d.localidades_adheridas : null)

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Última etapa habilitada" valor={d.ultima_etapa_habilitada ?? '—'} detalle={`${fmtN(d.localidades_adheridas)} localidades adheridas`} />
        <Kpi label="Saldo en cuenta" valor={fmtMonto(d.saldo_cuenta)} detalle={ctx.codigos ? 'es del fondo entero: solo sin filtro' : 'según planilla'} />
        <Kpi label="Disponible en etapas sin otorgar" valor={fmtMonto(d.disponible)} detalle={`${fmtN(d.localidades_con_disponible)} localidades`} />
        <Kpi label="Listo para pagar" valor={fmtMonto(d.listo_para_pagar.monto)} detalle={`${fmtN(d.listo_para_pagar.prestamos)} préstamos`} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel titulo="Localidades que recibieron las últimas etapas" ayuda="Sobre las localidades adheridas, hoy.">
          <div className="grid grid-cols-2 gap-2">
            <Velocimetro valor={pct(d.recibieron_ultima)} etiqueta={`Última etapa (${fmtN(d.recibieron_ultima)})`} max={1} color="#2e8b57" />
            <Velocimetro valor={pct(d.recibieron_anteultima)} etiqueta={`Anteúltima etapa (${fmtN(d.recibieron_anteultima)})`} max={1} />
          </div>
        </Panel>
        <Panel titulo="Préstamos otorgados" ayuda="Filtro propio de esta parte: por defecto, toda la gestión." extra={<SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de los préstamos" />}>
          <Kpis>
            <Kpi label="Otorgado" valor={fmtMonto(otorgado.monto)} detalle={periodo} />
            <Kpi label="Préstamos" valor={fmtN(otorgado.prestamos)} detalle={`${fmtN(otorgado.localidades)} localidades · ${fmtPct(pct(otorgado.localidades))}`} />
          </Kpis>
          <div className="mt-3">
            {delAnio ? (
              <BarChart labels={MESES} values={delAnio.mensual.map((v) => (v ?? 0) / 1e6)} height={200} tooltipSuffix=" M" />
            ) : (
              <BarChart labels={porAnio.map((a) => String(a.anio))} values={porAnio.map((a) => a.otorgado.monto / 1e6)} height={200} tooltipSuffix=" M" />
            )}
          </div>
        </Panel>
      </div>

      <Panel titulo="Préstamos" ayuda={`Otorgados ${periodo}${anio === 'gestion' ? ', más los listos para pagar' : ''}. Se devuelven en cuotas descontadas de la coparticipación.`}>
        <Tabla
          columnas={COL_PRESTAMOS}
          filas={prestamos}
          archivo="fondo_permanente_prestamos.xlsx"
          total={['Total', '', '', '', fmtMonto(prestamos.reduce((a, p) => a + p.monto_total, 0)), '', '', '', '', '']}
        />
      </Panel>

      <Panel titulo="Etapas por localidad" ayuda="Última etapa recibida y etapas habilitadas que todavía no pidió, con su monto.">
        <Tabla
          columnas={COL_LOCALIDADES}
          filas={d.localidades}
          archivo="fondo_permanente_etapas.xlsx"
          total={['Total', '', '', fmtN(d.recibieron_ultima), fmtN(d.recibieron_anteultima), '', fmtMonto(d.disponible)]}
        />
      </Panel>

      <Aviso>
        La página "Fondo Federal" del Looker parece salir de esta misma planilla (etapas, saldo en cuenta y los dos velocímetros). Le preguntamos al
        área si son el mismo fondo; mientras tanto, los préstamos no se suman al total del Resumen general porque se devuelven.
      </Aviso>
      <Fuente>planilla "7. FONDO PERMANENTE" de Gobierno, pestañas FONDO PERM, FONDO PERM CUOTAS e IMPORT_Listo (sincronizada a diario).</Fuente>
    </div>
  )
}
