import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

// Registro único de los componentes de Chart.js que usan Donut/Bar/LineChart.
// Chart.js es tree-shakeable — sin este registro los gráficos no dibujan nada.
Chart.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
)

export { Chart }
