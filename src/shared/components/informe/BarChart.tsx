import { useEffect, useRef } from 'react'
import { Chart } from './chartSetup'

// Plugin liviano propio (sin agregar chartjs-plugin-annotation como
// dependencia nueva) — dibuja una línea vertical punteada en el valor dado,
// sobre el eje `x` (el eje de "valor" cuando `indexAxis: 'y'`, horizontal).
// Pedido 2026-10-01: el promedio provincial/departamental del gráfico de
// ATP (y la referencia "proporcional" de Focalización, en 1.00) pasan de
// barra horizontal a línea de referencia.
interface LineaReferenciaOpts {
  valor?: number
  color?: string
}
const lineaReferenciaPlugin = {
  id: 'lineaReferencia',
  afterDraw(chart: Chart, _args: unknown, opts: LineaReferenciaOpts) {
    if (opts?.valor == null) return
    const { ctx, chartArea, scales } = chart
    const xScale = scales.x
    if (!xScale || !chartArea) return
    const x = xScale.getPixelForValue(opts.valor)
    ctx.save()
    ctx.beginPath()
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    ctx.strokeStyle = opts.color ?? '#172c3f'
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

export function BarChart({
  labels,
  values,
  color = '#01aae3',
  colors,
  horizontal = false,
  height = 300,
  tooltipSuffix = '',
  lineaReferencia,
}: {
  labels: string[]
  values: number[]
  color?: string
  /** Color por barra (ej. escala divergente) — si viene, gana sobre `color`. */
  colors?: string[]
  horizontal?: boolean
  height?: number
  tooltipSuffix?: string
  /** Línea vertical punteada de referencia (ej. promedio provincial/
   * departamental) — sólo tiene sentido con `horizontal` (el valor se ubica
   * sobre el eje `x`, que es el eje de magnitud en ese caso). */
  lineaReferencia?: { valor: number; color?: string }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: colors ?? color, borderRadius: 3 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltipSuffix ? { callbacks: { label: (ctx) => `${ctx.formattedValue}${tooltipSuffix}` } } : undefined,
          // @ts-expect-error — opciones del plugin propio, no tipadas por @types/chart.js
          lineaReferencia: lineaReferencia ?? { valor: undefined },
        },
        scales: {
          x: { ticks: { font: { size: 10 } }, grid: { display: !horizontal } },
          y: { ticks: { font: { size: 10 } }, grid: { display: horizontal } },
        },
      },
      plugins: lineaReferencia ? [lineaReferenciaPlugin] : [],
    })
    return () => chartRef.current?.destroy()
  }, [labels, values, color, colors, horizontal, tooltipSuffix, lineaReferencia])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
