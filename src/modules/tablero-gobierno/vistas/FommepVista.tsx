import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type FommepLocalidad } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, type Columna } from '../components/Bloques'
import { fmtMonto, fmtN } from '../formato'
import type { ContextoTablero } from './contexto'

const COLUMNAS: Columna<FommepLocalidad>[] = [
  { titulo: 'Año', valor: (f) => f.anio },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Móviles', valor: (f) => f.cant_moviles, numerica: true },
  { titulo: 'Monto móviles', valor: (f) => f.monto_moviles, render: (f) => fmtMonto(f.monto_moviles), numerica: true },
  { titulo: 'Edificios', valor: (f) => f.cant_edificios, numerica: true },
  { titulo: 'Monto edificios', valor: (f) => f.monto_edificios, render: (f) => fmtMonto(f.monto_edificios), numerica: true },
  { titulo: 'Total (planilla)', valor: (f) => f.monto_total, render: (f) => fmtMonto(f.monto_total), numerica: true },
]

/** FOMMEP (Etapa 2): planilla "11.1 FOMMEP", anual. Tiene su propio filtro de año (por
 * defecto toda la gestión; spec-tablero-gobierno-panel.md §2.5 #6), así que el año de la barra
 * común no se aplica. */
export function FommepVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'fommep', ctx.codigos], queryFn: () => tableroApi.fommep(ctx.anio, ctx.codigos) })

  if (q.isError) return <Aviso tono="error">No pudimos cargar FOMMEP. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.gestion) return <Aviso tono="warn">Todavía no hay datos sincronizados de la planilla de FOMMEP.</Aviso>
  const k = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.kpis ?? d.gestion
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const filas = anio === 'gestion' ? d.por_localidad : d.por_localidad.filter((f) => f.anio === anio)
  const grupos: [string, typeof k.moviles][] = [
    ['Móviles', k.moviles],
    ['Edificios categoría A', k.edificios_a],
    ['Edificios categoría B', k.edificios_b],
    ['Edificios categoría C', k.edificios_c],
  ]
  const porAnio = [...d.por_anio].reverse()

  return (
    <div className="space-y-4">
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión.">
        <SelectorAnio anios={[...d.anios].reverse()} valor={anio} onChange={setAnio} etiqueta="Año de FOMMEP" />
      </Panel>

      <Kpis>
        <Kpi label="Localidades con FOMMEP" valor={fmtN(k.localidades)} detalle={periodo} />
        <Kpi label="Total FOMMEP" valor={fmtMonto(k.monto_total)} detalle={`${periodo} · total de la planilla`} />
        {grupos.map(([nombre, g]) => (
          <Kpi key={nombre} label={nombre} valor={fmtMonto(g.monto)} detalle={`${fmtN(g.cantidad)} ${nombre === 'Móviles' ? 'móviles' : 'edificios'}`} />
        ))}
      </Kpis>

      {Math.abs(k.otros) >= 1 && (
        <Aviso tono="warn">
          El total de la planilla supera a móviles + edificios en {fmtMonto(k.otros)}. Le preguntamos al área qué más incluye; mientras tanto se
          muestra el total tal como viene.
        </Aviso>
      )}

      <Panel titulo="Por año" ayuda="Total FOMMEP de cada año, en millones.">
        <BarChart
          labels={porAnio.map((a) => String(a.anio))}
          values={porAnio.map((a) => a.kpis.monto_total / 1e6)}
          colors={porAnio.map((a) => (anio === 'gestion' || a.anio === anio ? '#398ebd' : '#c9d6e2'))}
          height={200}
          tooltipSuffix=" M"
        />
      </Panel>

      <Panel titulo="Por localidad" ayuda={`Localidades con FOMMEP ${periodo}.`}>
        <Tabla
          columnas={COLUMNAS}
          filas={filas}
          archivo="fommep.xlsx"
          total={['Total', '', '', fmtN(k.moviles.cantidad), fmtMonto(k.moviles.monto), fmtN(k.edificios.cantidad), fmtMonto(k.edificios.monto), fmtMonto(k.monto_total)]}
        />
      </Panel>
      <Fuente>planilla "11.1 FOMMEP" de Gobierno, pestaña FROMMEP (anual, sincronizada a diario).</Fuente>
    </div>
  )
}
