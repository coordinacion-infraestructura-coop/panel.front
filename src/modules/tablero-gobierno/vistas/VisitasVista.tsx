import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type VisitaFila, type VisitasPeriodo } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, type Columna } from '../components/Bloques'
import { CoberturaPorDepartamento, CoberturaVelocimetros } from '../components/Cobertura'
import { MESES, fmtFecha, fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const capital = (s: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '—')

const COL_VISITAS: Columna<VisitaFila>[] = [
  { titulo: 'Fecha', valor: (f) => f.fecha, render: (f) => fmtFecha(f.fecha) },
  { titulo: 'Localidad', valor: (f) => f.localidad },
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Funcionario', valor: (f) => f.funcionario },
  { titulo: 'Tipo de visita', valor: (f) => f.tipo, render: (f) => capital(f.tipo) },
]

type Funcionario = VisitasPeriodo['por_funcionario'][number]

/** Visitas en territorio (Etapa 5, spec-datos-externos-fase5-gestion-territorial.md §4):
 * planillas "2. RECORRIDO Y VISITAS" (funcionarios) y "2.1" (ministro). */
export function VisitasVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'visitas', ctx.codigos], queryFn: () => tableroApi.visitas(ctx.codigos) })
  const visitas = useMemo(() => (!q.data ? [] : anio === 'gestion' ? q.data.visitas : q.data.visitas.filter((v) => v.fecha.startsWith(String(anio)))), [q.data, anio])

  if (q.isError) return <Aviso tono="error">No pudimos cargar las visitas. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.visitas.length) {
    return <Aviso tono="warn">{ctx.codigos ? 'No hay visitas registradas para este filtro.' : 'Todavía no hay datos sincronizados de las planillas de recorridos.'}</Aviso>
  }
  const p = anio === 'gestion' ? d.gestion : d.por_anio.find((a) => a.anio === anio)?.periodo ?? d.gestion
  const c = p.cobertura
  const periodo = anio === 'gestion' ? 'en la gestión' : `en ${anio}`
  const colFunc: Columna<Funcionario>[] = [
    { titulo: 'Funcionario', valor: (f) => f.funcionario },
    { titulo: 'Actividades', valor: (f) => f.actividades, numerica: true },
    { titulo: 'Localidades', valor: (f) => f.localidades, numerica: true },
    { titulo: '% del total', valor: (f) => (c.total ? f.localidades / c.total : null), render: (f) => fmtPct(c.total ? f.localidades / c.total : null), numerica: true },
    { titulo: 'Municipios', valor: (f) => f.municipios, numerica: true },
    { titulo: 'Comunas', valor: (f) => f.comunas, numerica: true },
  ]

  return (
    <div className="space-y-4">
      <Panel titulo="Año" ayuda="Filtro propio de esta página: por defecto muestra toda la gestión.">
        <SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de las visitas" />
      </Panel>

      <Kpis>
        <Kpi label="Visitas" valor={fmtN(p.visitas)} detalle={periodo} />
        <Kpi label="Localidades visitadas" valor={fmtN(c.visitadas)} detalle={`de ${fmtN(c.total)} · ${fmtPct(c.total ? c.visitadas / c.total : null)}`} />
        <Kpi label="Municipios visitados" valor={fmtN(c.municipios_visitados)} detalle={`de ${fmtN(c.municipios)}`} />
        <Kpi label="Comunas visitadas" valor={fmtN(c.comunas_visitadas)} detalle={`de ${fmtN(c.comunas)}`} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel titulo="Cobertura" ayuda={`Localidades con al menos una visita ${periodo}.`}>
          <CoberturaVelocimetros c={c} />
        </Panel>
        <Panel titulo={anio === 'gestion' ? 'Visitas por año' : `Visitas por mes de ${anio}`}>
          {anio === 'gestion' ? (
            <BarChart labels={d.por_anio.map((a) => String(a.anio))} values={d.por_anio.map((a) => a.periodo.visitas)} height={200} />
          ) : (
            <BarChart labels={MESES} values={p.mensual} height={200} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel titulo="Por funcionario" ayuda="Para un funcionario se cuentan actividades, no visitas. Las de la planilla 2.1 son del ministro.">
          <Tabla columnas={colFunc} filas={p.por_funcionario} archivo="visitas_por_funcionario.xlsx" />
        </Panel>
        <Panel titulo="Por tipo de visita">
          <BarChart labels={p.por_tipo.map((t) => capital(t.clave))} values={p.por_tipo.map((t) => t.cantidad)} horizontal height={Math.max(160, p.por_tipo.length * 28)} />
        </Panel>
      </div>

      <Panel titulo="Cobertura por departamento" ayuda="De menor a mayor cobertura.">
        <CoberturaPorDepartamento filas={p.por_departamento} archivo="visitas_cobertura_departamentos.xlsx" />
      </Panel>

      <Panel titulo="Visitas registradas" ayuda={`Visitas ${periodo}, de la más reciente a la más vieja.`}>
        <Tabla columnas={COL_VISITAS} filas={visitas} archivo="visitas.xlsx" />
      </Panel>

      <Aviso>
        Última visita cargada: funcionarios {fmtFecha(d.ultima_fecha.funcionarios)}, ministro {fmtFecha(d.ultima_fecha.ministro)}. Las visitas con
        fecha futura o sin localidad reconocida no se cuentan (errores de carga, según el área).
      </Aviso>
      <Fuente>planillas "2. RECORRIDO Y VISITAS" y "2.1 RECORRIDO Y VISITAS - CALVO" de Gobierno, pestaña Recorrido (sincronizadas a diario).</Fuente>
    </div>
  )
}
