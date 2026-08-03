import { useEffect, useRef } from 'react'
import { Chart } from './chartSetup'

export function BarChart({
  labels,
  values,
  color = '#01aae3',
  horizontal = false,
  height = 300,
}: {
  labels: string[]
  values: number[]
  color?: string
  horizontal?: boolean
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 3 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 } }, grid: { display: !horizontal } },
          y: { ticks: { font: { size: 10 } }, grid: { display: horizontal } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [labels, values, color, horizontal])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
