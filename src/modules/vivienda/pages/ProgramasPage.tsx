import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { cordonCunetaApi, cordobaHogarApi } from '../api/vivienda.api'

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
        card.kpis.length === 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
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
  const ccQuery = useQuery({
    queryKey: ['cordon-cuneta'],
    queryFn: cordonCunetaApi.getPanel,
  })

  const chQuery = useQuery({
    queryKey: ['cordoba-hogar'],
    queryFn: cordobaHogarApi.getPanel,
  })

  const cc = ccQuery.data
  const ch = chQuery.data

  const ccMunicipios = cc?.municipios ?? []
  const ccConExpediente = ccMunicipios.filter((m) => m.expediente).length
  const ccConvenioFirmado = ccMunicipios.filter((m) => m.ok_gob === 'SI').length
  const ccMonto = ccMunicipios.reduce((acc, m) => acc + (m.monto ?? 0), 0)
  const ccTcId = cc?.estados.find((e) => e.label.toLowerCase() === 'tc')?.id
  const ccEnTC = ccTcId != null ? ccMunicipios.filter((m) => m.estado_general === ccTcId).length : 0

  const chLocalidades = ch?.localidades ?? []
  const chTotalCasas = chLocalidades.reduce((acc, l) => acc + (l.cantidad_casas ?? 0), 0)
  const chConOkGob = chLocalidades.filter((l) => l.ok_gob === 'SI').length
  const chConExpediente = chLocalidades.filter((l) => l.expediente).length
  const chMonto = chLocalidades.reduce((acc, l) => acc + (l.monto ?? 0), 0)
  const chTcId = ch?.estados.find((e) => e.label.toLowerCase() === 'tc')?.id
  const chEnTC = chTcId != null ? chLocalidades.filter((l) => l.estado_general === chTcId).length : 0

  const cards: ProgramCard[] = [
    {
      nombre: 'Córdoba Hogar',
      descripcion: 'Programa habitacional — versión provisoria, sujeto a modificaciones',
      tag: 'Programa habitacional',
      to: '/vivienda/cordoba-hogar',
      loading: chQuery.isLoading,
      error: !!chQuery.error,
      kpis: [
        { label: 'Localidades', value: chLocalidades.length },
        {
          label: 'Viviendas anunciadas',
          value: chTotalCasas.toLocaleString('es-AR'),
          sub: 'casas',
        },
        {
          label: 'OK Gobernación',
          value: chLocalidades.length ? `${chConOkGob} / ${chLocalidades.length}` : '—',
          sub: `con expediente: ${chConExpediente}`,
        },
        { label: 'Inversión total', value: fmtMonto(chMonto) },
        { label: 'Tribunal de Cuentas', value: chEnTC, sub: 'en estado TC' },
      ],
    },
    {
      nombre: 'Cordón Cuneta y Adoquinado',
      descripcion: 'Convenios con municipios — seguimiento de estados de avance',
      tag: 'Infraestructura urbana',
      to: '/vivienda/cordon-cuneta',
      loading: ccQuery.isLoading,
      error: !!ccQuery.error,
      kpis: [
        { label: 'Municipios', value: ccMunicipios.length },
        {
          label: 'Con expediente',
          value: ccMunicipios.length ? `${ccConExpediente} / ${ccMunicipios.length}` : '—',
        },
        {
          label: 'Convenio firmado',
          value: ccMunicipios.length ? `${ccConvenioFirmado} / ${ccMunicipios.length}` : '—',
          sub: 'OK Gobernación',
        },
        { label: 'Monto comprometido', value: fmtMonto(ccMonto) },
        { label: 'Tribunal de Cuentas', value: ccEnTC, sub: 'en estado TC' },
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
