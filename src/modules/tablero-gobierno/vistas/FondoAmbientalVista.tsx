import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { tableroApi, type FondoAmbientalFila } from '../api/tablero.api'
import { Aviso, Cargando, EstadoFondo, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, colorEstadoFondo, type Columna } from '../components/Bloques'
import { fmtFecha, fmtMonto, fmtN } from '../formato'
import type { ContextoTablero } from './contexto'

const COLUMNAS: Columna<FondoAmbientalFila>[] = [
  { titulo: 'Año', valor: (f) => f.anio },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  {
    titulo: 'Localidad o ente',
    valor: (f) => f.localidad,
    render: (f) => (
      <>
        {f.localidad}
        {f.es_ente && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gov-cyan font-semibold">ente</span>}
      </>
    ),
  },
  { titulo: 'Objeto', valor: (f) => f.objeto, render: (f) => <span className="inline-block max-w-[280px] truncate align-bottom" title={f.objeto ?? ''}>{f.objeto ?? '—'}</span> },
  { titulo: 'Monto', valor: (f) => f.monto, render: (f) => fmtMonto(f.monto), numerica: true },
  { titulo: 'Estado', valor: (f) => f.estado, render: (f) => <EstadoFondo estado={f.estado} /> },
  { titulo: 'Fecha estado', valor: (f) => f.fecha_estado, render: (f) => fmtFecha(f.fecha_estado) },
  { titulo: 'Convenio', valor: (f) => f.convenio },
  { titulo: 'Fecha convenio', valor: (f) => f.fecha_convenio, render: (f) => fmtFecha(f.fecha_convenio) },
  { titulo: 'Expediente', valor: (f) => f.expediente },
  { titulo: 'Resolución', valor: (f) => f.resolucion },
]

/** Mismo agrupamiento que el backend (`fondos.objeto_base`): sin código de glosario ni tildes. */
const objetoBase = (o: string | null) =>
  (o ?? '').replace(/\(\d+\)/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim() || 'SIN OBJETO'

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** Fondo Ambiental (Etapa 3): planilla "9. FONDO AMBIENTAL". Filtro de año propio, como FOMMEP
 * (spec-datos-externos-fase3-fondos.md §4). */
export function FondoAmbientalVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'fondo-ambiental', ctx.codigos], queryFn: () => tableroApi.fondoAmbiental(ctx.anio, ctx.codigos) })
  const filas = useMemo(
    () => (!q.data ? [] : anio === 'gestion' ? q.data.convenios : q.data.convenios.filter((c) => c.anio === anio)),
    [q.data, anio],
  )
  const objetos = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of filas) m.set(objetoBase(f.objeto), (m.get(objetoBase(f.objeto)) ?? 0) + f.monto)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [filas])

  if (q.isError) return <Aviso tono="error">No pudimos cargar el Fondo Ambiental. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.gestion) {
    return <Aviso tono="warn">{ctx.codigos ? 'No hay convenios del Fondo Ambiental para este filtro.' : 'Todavía no hay datos sincronizados de la planilla del Fondo Ambiental.'}</Aviso>
  }
  const k = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.kpis ?? d.gestion
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const conMonto = k.estados.filter((e) => e.monto > 0)

  return (
    <div className="space-y-4">
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión.">
        <SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año del Fondo Ambiental" />
      </Panel>

      <Kpis>
        <Kpi label="Localidades con Fondo Ambiental" valor={fmtN(k.localidades)} detalle={periodo} />
        <Kpi label="Entes con Fondo Ambiental" valor={fmtN(k.entes)} detalle="comunidades regionales y entes intermunicipales" />
        <Kpi label="Ingresos del fondo" valor={fmtMonto(k.ingresos)} detalle={ctx.codigos ? 'es del fondo entero: solo sin filtro' : periodo} />
        <Kpi label="Afectado" valor={fmtMonto(k.afectado)} detalle={`${fmtN(k.convenios)} convenios`} />
        <Kpi label="Disponible" valor={fmtMonto(k.disponible)} detalle="ingresos − afectado" />
      </Kpis>

      <Kpis>
        {k.estados.map((e) => (
          <Kpi key={e.estado} label={capital(e.estado)} valor={fmtMonto(e.monto)} detalle={`${fmtN(e.cantidad)} convenios`} />
        ))}
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel titulo="Por estado de pago" ayuda="Monto afectado.">
          {conMonto.length ? (
            <DonutChart
              labels={conMonto.map((e) => `${capital(e.estado)} (${e.cantidad})`)}
              values={conMonto.map((e) => e.monto)}
              colors={conMonto.map((e) => colorEstadoFondo(e.estado))}
              height={240}
            />
          ) : (
            <p className="text-sm text-gray-500">Sin convenios {periodo}.</p>
          )}
        </Panel>
        <Panel titulo="Qué se financió" ayuda="Monto por objeto del convenio, en millones (los 10 mayores).">
          <BarChart labels={objetos.map(([o]) => o)} values={objetos.map(([, m]) => m / 1e6)} horizontal height={Math.max(180, objetos.length * 30)} tooltipSuffix=" M" />
        </Panel>
      </div>

      <Panel titulo="Convenios" ayuda={`Convenios ${periodo}.${ctx.codigos ? ' Con un filtro territorial entran también los entes del departamento.' : ''}`}>
        <Tabla
          columnas={COLUMNAS}
          filas={filas}
          archivo="fondo_ambiental.xlsx"
          total={['Total', '', '', '', fmtMonto(k.afectado), '', '', '', '', '', '']}
        />
      </Panel>

      <Aviso>Lo transferido a comunidades regionales y entes no entra en el total por localidad del Resumen general, igual que en el Looker.</Aviso>
      <Fuente>planilla "9. FONDO AMBIENTAL" de Gobierno, pestaña Fondo (sincronizada a diario).</Fuente>
    </div>
  )
}
