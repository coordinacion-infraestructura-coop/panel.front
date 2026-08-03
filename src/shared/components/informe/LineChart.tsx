import { useEffect, useRef } from 'react'
import { Chart } from './chartSetup'

export function LineChart({
  labels,
  values,
  color = '#172c3f',
  height = 280,
}: {
  labels: string[]
  values: number[]
  color?: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            backgroundColor: `${color}22`,
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: { ticks: { font: { size: 10 }, precision: 0 }, beginAtZero: true },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [labels, values, color])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
