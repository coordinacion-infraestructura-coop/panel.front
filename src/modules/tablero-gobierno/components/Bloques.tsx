import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chart } from '../../../shared/components/informe/chartSetup'
import { exportToXlsx } from '../../../shared/utils/exportTable'

// Piezas comunes de las pantallas del tablero (spec §2.3): KPI → panel con gráfico → tabla.
// Mismo lenguaje visual que la maqueta aprobada.

export function Kpis({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">{children}</div>
}

export function Kpi({ label, valor, detalle }: { label: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-[22px] font-bold text-gov-navy leading-tight tabular-nums break-words">{valor}</p>
      {detalle && <p className="text-xs text-gray-500 mt-0.5">{detalle}</p>}
    </div>
  )
}

export function Panel({ titulo, ayuda, extra, children }: { titulo: string; ayuda?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gov-navy">{titulo}</h3>
          {ayuda && <p className="text-xs text-gray-500 mt-0.5">{ayuda}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

export function Aviso({ tono = 'info', children }: { tono?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const cls = {
    info: 'border-gov-blue bg-[#eef5fa]',
    warn: 'border-amber-500 bg-amber-50',
    error: 'border-red-500 bg-red-50 text-red-800',
  }[tono]
  return <div className={`border-l-4 ${cls} rounded-md px-3 py-2 text-[13px] text-gov-navy`}>{children}</div>
}

export const Fuente = ({ children }: { children: ReactNode }) => <p className="text-xs text-gray-500">Fuente: {children}</p>

export function Cargando() {
  return <div className="h-40 bg-white border border-slate-200 rounded-lg animate-pulse" aria-label="Cargando" />
}

/** Barras por categoría (Chart.js): agrupadas (una serie por año), apiladas (transferido /
 * pendiente) u horizontales. `null` = sin dato. `pie` agrega una línea al tooltip. */
export function SerieComparada({
  labels,
  series,
  formato,
  height = 260,
  apiladas = false,
  horizontal = false,
  pie,
  ariaLabel = 'Serie mensual comparada',
}: {
  labels: string[]
  series: { nombre: string; valores: (number | null)[]; color: string }[]
  formato: (v: number) => string
  height?: number
  apiladas?: boolean
  horizontal?: boolean
  pie?: (indice: number) => string | undefined
  ariaLabel?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const valor = { ticks: { callback: (v: string | number) => formato(Number(v)), font: { size: 10 } }, grid: { color: '#e5e7eb' }, stacked: apiladas }
    const categoria = { grid: { display: false }, ticks: { font: { size: 11 } }, stacked: apiladas }
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: series.map((s) => ({ label: s.nombre, data: s.valores, backgroundColor: s.color, borderRadius: 3 })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Poppins', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${c.raw == null ? 'sin dato' : formato(c.raw as number)}`,
              footer: (items) => (pie && items[0] ? pie(items[0].dataIndex) ?? '' : ''),
            },
          },
        },
        scales: horizontal ? { x: valor, y: categoria } : { y: valor, x: categoria },
      },
    })
    return () => chart.destroy()
  }, [labels, series, formato, apiladas, horizontal, pie])
  return (
    <div style={{ height }}>
      <canvas ref={ref} role="img" aria-label={ariaLabel} />
    </div>
  )
}

/** Velocímetro semicircular (SVG). `max` > 1 deja ver valores por encima del 100 %. */
export function Velocimetro({ valor, etiqueta, max = 1.5, color = '#398ebd' }: { valor: number | null; etiqueta: string; max?: number; color?: string }) {
  const r = 70
  const frac = valor == null ? 0 : Math.max(0, Math.min(valor / max, 1))
  const ang = Math.PI * (1 - frac)
  const x = 90 + r * Math.cos(ang)
  const y = 90 - r * Math.sin(ang)
  const cien = Math.PI * (1 - Math.min(1 / max, 1))
  return (
    <figure className="flex flex-col items-center min-w-0">
      <svg viewBox="0 0 180 104" className="w-full max-w-[220px]" role="img" aria-label={`${etiqueta}: ${valor == null ? 'sin dato' : `${Math.round(valor * 1000) / 10} %`}`}>
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#e5e7eb" strokeWidth="16" />
        {valor != null && frac > 0 && (
          <path d={`M 20 90 A 70 70 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={color} strokeWidth="16" />
        )}
        {max > 1 && (
          <line x1={90 + 58 * Math.cos(cien)} y1={90 - 58 * Math.sin(cien)} x2={90 + 82 * Math.cos(cien)} y2={90 - 82 * Math.sin(cien)} stroke="#172c3f" strokeWidth="2" strokeDasharray="3 2" />
        )}
        <text x="90" y="86" textAnchor="middle" className="fill-gov-navy" style={{ fontSize: 22, fontWeight: 700 }}>
          {valor == null ? '—' : `${(valor * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`}
        </text>
      </svg>
      <figcaption className="text-xs text-gray-600 text-center -mt-1">{etiqueta}</figcaption>
    </figure>
  )
}

export interface Columna<T> {
  titulo: string
  valor: (f: T) => string | number | null
  render?: (f: T) => ReactNode
  numerica?: boolean
}

/** Tabla con búsqueda y exportación a Excel (spec §2.1). Muestra 50 filas por página. */
export function Tabla<T>({ columnas, filas, archivo, total }: { columnas: Columna<T>[]; filas: T[]; archivo: string; total?: ReactNode[] }) {
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(0)
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? filas.filter((f) => columnas.some((c) => String(c.valor(f) ?? '').toLowerCase().includes(t))) : filas
  }, [q, filas, columnas])
  const POR_PAGINA = 50
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPagina(0) }}
          placeholder="Buscar en la tabla"
          aria-label="Buscar en la tabla"
          className="text-sm border border-slate-300 rounded-md px-2.5 py-1.5 w-56 max-w-full"
        />
        <span className="text-xs text-gray-500">{filtradas.length} filas</span>
        <button
          type="button"
          onClick={() => exportToXlsx(filtradas.map((f) => Object.fromEntries(columnas.map((c) => [c.titulo, c.valor(f)]))), 'Datos', archivo)}
          className="text-xs border border-slate-300 rounded-md px-3 py-1.5 hover:border-gov-blue"
        >
          Exportar a Excel
        </button>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-50">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className={`px-2.5 py-2 text-[11px] uppercase tracking-wide text-gray-500 font-semibold whitespace-nowrap ${c.numerica ? 'text-right' : 'text-left'}`}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f, i) => (
              <tr key={i} className="border-t border-slate-100">
                {columnas.map((c) => (
                  <td key={c.titulo} className={`px-2.5 py-1.5 whitespace-nowrap ${c.numerica ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(f) : (c.valor(f) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {total && (
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                {total.map((t, i) => (
                  <td key={i} className={`px-2.5 py-1.5 whitespace-nowrap ${columnas[i]?.numerica ? 'text-right tabular-nums' : ''}`}>{t}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <button type="button" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="border rounded px-2 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {pagina + 1} de {paginas}</span>
          <button type="button" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)} className="border rounded px-2 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  )
}

export function EstadoPill({ estado }: { estado: string }) {
  const cls =
    estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700'
    : estado === 'Parcial' ? 'bg-sky-50 text-sky-700'
    : estado === 'Pendiente' ? 'bg-amber-50 text-amber-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{estado}</span>
}
