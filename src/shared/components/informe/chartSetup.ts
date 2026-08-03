import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

// Registro único de los componentes de Chart.js que usan Donut/Bar/LineChart.
// Chart.js es tree-shakeable — hacen falta tanto los controllers (uno por tipo
// de gráfico: Doughnut/Bar/Line) como los elements (Arc/Bar/Line/Point) que esos
// controllers dibujan. Sin los controllers da "X is not a registered controller".
Chart.register(
  DoughnutController,
  BarController,
  LineController,
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
