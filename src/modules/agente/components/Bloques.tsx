// Bloques estructurados de una respuesta del agente (spec-agente-consultas.md §6.3): kpi, tabla, link.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { exportToXlsx } from '../../../shared/utils/exportTable'
import type { Bloque } from '../api/agente.api'

const FILAS_INICIALES = 10

function celda(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return v.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.length === 10 ? `${v}T12:00:00` : v)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-AR')
  }
  return String(v)
}

function Kpi({ b }: { b: Extract<Bloque, { tipo: 'kpi' }> }) {
  const valor = typeof b.valor === 'number'
    ? (b.unidad === '$' ? `$ ${Math.round(b.valor).toLocaleString('es-AR')}` : b.valor.toLocaleString('es-AR'))
    : (b.valor ?? '—')
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 min-w-[10rem]">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{b.titulo}</p>
      <p className="text-2xl font-semibold text-gov-navy tabular-nums">{valor}</p>
      {b.unidad && b.unidad !== '$' && <p className="text-xs text-slate-500">{b.unidad}</p>}
    </div>
  )
}

function Tabla({ b }: { b: Extract<Bloque, { tipo: 'tabla' }> }) {
  const [todas, setTodas] = useState(false)
  const visibles = todas ? b.filas : b.filas.slice(0, FILAS_INICIALES)
  const exportar = () =>
    exportToXlsx(
      b.filas.map((f) => Object.fromEntries(b.columnas.map((c, i) => [c, f[i] ?? null]))),
      (b.titulo ?? 'Consulta').slice(0, 31),
      `consulta_${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <p className="text-sm font-medium text-gov-navy">{b.titulo ?? 'Resultado'}</p>
        <button onClick={exportar} className="text-xs text-gov-blue hover:underline">Descargar Excel</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              {b.columnas.map((c) => <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f, i) => (
              <tr key={i} className="border-t border-slate-100">
                {f.map((v, j) => (
                  <td key={j} className={`px-3 py-1.5 ${typeof v === 'number' ? 'text-right tabular-nums' : ''}`}>{celda(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(b.filas.length > FILAS_INICIALES || b.total_filas > b.filas.length) && (
        <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-500 flex gap-3">
          {b.filas.length > FILAS_INICIALES && (
            <button onClick={() => setTodas(!todas)} className="text-gov-blue hover:underline">
              {todas ? 'Ver menos' : `Ver las ${b.filas.length} filas`}
            </button>
          )}
          {b.total_filas > b.filas.length && <span>Se muestran {b.filas.length} de {b.total_filas}.</span>}
        </div>
      )}
    </div>
  )
}

export function Bloques({ bloques }: { bloques: Bloque[] }) {
  if (!bloques.length) return null
  const kpis = bloques.filter((b) => b.tipo === 'kpi') as Extract<Bloque, { tipo: 'kpi' }>[]
  const tablas = bloques.filter((b) => b.tipo === 'tabla') as Extract<Bloque, { tipo: 'tabla' }>[]
  const links = bloques.filter((b) => b.tipo === 'link') as Extract<Bloque, { tipo: 'link' }>[]
  return (
    <div className="space-y-3 mt-3">
      {kpis.length > 0 && <div className="flex flex-wrap gap-2">{kpis.map((b) => <Kpi key={b.id} b={b} />)}</div>}
      {tablas.map((b) => <Tabla key={b.id} b={b} />)}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((b) => (
            <Link key={b.id} to={b.url} className="text-sm px-3 py-1.5 rounded-full border border-gov-cyan/50 text-gov-blue hover:bg-gov-cyan/10">
              {b.texto} →
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
