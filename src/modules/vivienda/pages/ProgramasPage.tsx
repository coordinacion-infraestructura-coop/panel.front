import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { programasApi } from '../api/vivienda.api'

function fmtMonto(n: number) {
  if (!n) return '—'
  return '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

interface Kpi {
  label: string
  value: string | number
  sub?: string
}

interface ProgramCard {
  nombre: string
  descripcion: string
  tag: string
  to: string
  kpis: Kpi[]
  loading: boolean
  error: boolean
}

function ProgramaKPICard({ card }: { card: ProgramCard }) {
  return (
    <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
      <div className="bg-gov-navy px-5 py-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gov-cyan mb-0.5">
            {card.tag}
          </p>
          <h3 className="text-white font-semibold">{card.nombre}</h3>
          <p className="text-white/50 text-xs mt-0.5">{card.descripcion}</p>
        </div>
        <Link
          to={card.to}
          className="flex-shrink-0 text-xs bg-gov-cyan/20 hover:bg-gov-cyan/40 text-gov-cyan border border-gov-cyan/30 px-3 py-1.5 rounded font-medium transition-colors whitespace-nowrap mt-0.5"
        >
          Ver panel →
        </Link>
      </div>
      <div className={`grid divide-slate-100 border-t border-slate-100 ${
        card.kpis.length === 6 ? 'grid-cols-3 sm:grid-cols-6' :
        card.kpis.length === 5 ? 'grid-cols-2 sm:grid-cols-5' :
        'grid-cols-2 sm:grid-cols-4'
      }`}>
        {card.kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className={`px-5 py-4 ${i < card.kpis.length - 1 ? 'border-r border-slate-100' : ''}`}
          >
            <p className="text-xs text-gray-400 leading-tight">{kpi.label}</p>
            <p className="text-2xl font-bold text-gov-navy mt-1">
              {card.loading ? <span className="text-gray-200">—</span> : kpi.value}
            </p>
            {kpi.sub && <p className="text-[11px] text-gray-400 mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProgramasPage() {
  const { data: tablero, isLoading, isError } = useQuery({
    queryKey: ['programas-tablero'],
    queryFn: programasApi.getTablero,
  })

  const cc = tablero?.cordon_cuneta
  const ch = tablero?.cordoba_hogar
  const ml = tablero?.mi_lugar

  const cards: ProgramCard[] = [
    {
      nombre: 'Mi Lugar — Adquisición de Tierras',
      descripcion: 'Expropiaciones, convenios municipales y lotes provinciales',
      tag: 'Tierra y hábitat',
      to: '/vivienda/mi-lugar',
      loading: isLoading,
      error: isError,
      kpis: [
        { label: 'Proyectos totales', value: ml?.total ?? 0, sub: `Exp: ${ml?.exp ?? 0} | Muni: ${ml?.muni ?? 0} | Prov: ${ml?.prov ?? 0}` },
        { label: 'Lotes totales', value: (ml?.total_lotes ?? 0).toLocaleString('es-AR'), sub: 'sumados los 3 tipos' },
        { label: 'Con expediente', value: ml?.con_expediente ?? 0, sub: `de ${ml?.total ?? 0} proyectos` },
        { label: 'Monto comprometido', value: fmtMonto(ml?.monto ?? 0) },
      ],
    },
    {
      nombre: 'Córdoba Hogar',
      descripcion: 'Programa habitacional — versión provisoria, sujeto a modificaciones',
      tag: 'Programa habitacional',
      to: '/vivienda/cordoba-hogar',
      loading: isLoading,
      error: isError,
      kpis: [
        { label: 'Localidades', value: ch?.localidades ?? 0 },
        {
          label: 'Viviendas anunciadas',
          value: (ch?.total_casas ?? 0).toLocaleString('es-AR'),
          sub: 'casas',
        },
        {
          label: 'OK Gobernación',
          value: ch?.localidades ? `${ch.con_ok_gob} / ${ch.localidades}` : '—',
          sub: `con expediente: ${ch?.con_expediente ?? 0}`,
        },
        { label: 'Inversión total', value: fmtMonto(ch?.monto ?? 0) },
        { label: 'Tribunal de Cuentas', value: ch?.en_tc ?? 0, sub: 'en estado TC' },
      ],
    },
    {
      nombre: 'Cordón Cuneta y Adoquinado',
      descripcion: 'Convenios con municipios — seguimiento de estados de avance',
      tag: 'Infraestructura urbana',
      to: '/vivienda/cordon-cuneta',
      loading: isLoading,
      error: isError,
      kpis: [
        { label: 'Municipios', value: cc?.municipios ?? 0 },
        {
          label: 'Con expediente',
          value: cc?.municipios ? `${cc.con_expediente} / ${cc.municipios}` : '—',
        },
        {
          label: 'Convenio firmado',
          value: cc?.municipios ? `${cc.convenio_firmado} / ${cc.municipios}` : '—',
          sub: 'OK Gobernación',
        },
        { label: 'Monto comprometido', value: fmtMonto(cc?.monto ?? 0) },
        { label: 'En Obra', value: cc?.en_obra ?? 0, sub: 'estado general' },
        { label: 'Tribunal de Cuentas', value: cc?.en_tc ?? 0, sub: 'en estado TC' },
      ],
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gov-navy">Tablero de Programas</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Estado general de los programas activos de la Secretaría de Vivienda.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {cards.map((card) =>
          card.error ? (
            <div
              key={card.nombre}
              className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-600"
            >
              Error al cargar datos de {card.nombre}.
            </div>
          ) : (
            <ProgramaKPICard key={card.nombre} card={card} />
          ),
        )}
      </div>
    </div>
  )
}
