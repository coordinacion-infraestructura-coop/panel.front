import type { Cobertura, CoberturaDepartamento } from '../api/tablero.api'
import { fmtN, fmtPct } from '../formato'
import { Tabla, Velocimetro, type Columna } from './Bloques'

// Cobertura territorial de Visitas y Visitas del Gobernador (spec-tablero-gobierno-panel.md
// §2.5 #3): localidades alcanzadas sobre el total, municipios y comunas, siempre "X de Y".

const pct = (parte: number, total: number) => (total ? parte / total : null)
const xDeY = (parte: number, total: number) => `${fmtN(parte)} de ${fmtN(total)}`

export function CoberturaVelocimetros({ c, color = '#2e8b57' }: { c: Cobertura; color?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Velocimetro valor={pct(c.visitadas, c.total)} max={1} color={color} etiqueta={`Localidades · ${xDeY(c.visitadas, c.total)}`} />
      <Velocimetro valor={pct(c.municipios_visitados, c.municipios)} max={1} color={color} etiqueta={`Municipios · ${xDeY(c.municipios_visitados, c.municipios)}`} />
      <Velocimetro valor={pct(c.comunas_visitadas, c.comunas)} max={1} color={color} etiqueta={`Comunas · ${xDeY(c.comunas_visitadas, c.comunas)}`} />
    </div>
  )
}

const COLUMNAS: Columna<CoberturaDepartamento>[] = [
  { titulo: 'Departamento', valor: (f) => f.departamento },
  { titulo: 'Visitadas', valor: (f) => f.visitadas, render: (f) => xDeY(f.visitadas, f.total), numerica: true },
  { titulo: '%', valor: (f) => pct(f.visitadas, f.total), render: (f) => <Barra v={pct(f.visitadas, f.total)} />, numerica: true },
  { titulo: 'Municipios', valor: (f) => f.municipios_visitados, render: (f) => xDeY(f.municipios_visitados, f.municipios), numerica: true },
  { titulo: 'Comunas', valor: (f) => f.comunas_visitadas, render: (f) => xDeY(f.comunas_visitadas, f.comunas), numerica: true },
]

function Barra({ v }: { v: number | null }) {
  return (
    <span className="inline-flex items-center gap-2 justify-end w-full">
      <span className="inline-block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden" aria-hidden>
        <span className="block h-full bg-gov-blue" style={{ width: `${Math.round((v ?? 0) * 100)}%` }} />
      </span>
      {fmtPct(v)}
    </span>
  )
}

export function CoberturaPorDepartamento({ filas, archivo }: { filas: CoberturaDepartamento[]; archivo: string }) {
  return <Tabla columnas={COLUMNAS} filas={filas} archivo={archivo} />
}
