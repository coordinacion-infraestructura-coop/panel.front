import { useEffect, useRef } from 'react'
import { Chart } from './chartSetup'

export function BarChart({
  labels,
  values,
  color = '#01aae3',
  colors,
  horizontal = false,
  height = 300,
  tooltipSuffix = '',
}: {
  labels: string[]
  values: number[]
  color?: string
  /** Color por barra (ej. escala divergente) — si viene, gana sobre `color`. */
  colors?: string[]
  horizontal?: boolean
  height?: number
  tooltipSuffix?: string
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
        },
        scales: {
          x: { ticks: { font: { size: 10 } }, grid: { display: !horizontal } },
          y: { ticks: { font: { size: 10 } }, grid: { display: horizontal } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [labels, values, color, colors, horizontal, tooltipSuffix])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
