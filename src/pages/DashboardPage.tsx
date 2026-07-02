import { Link } from 'react-router-dom'
import { useAuth } from '../shared/auth/AuthContext'
import { usePortalUser } from '../shared/hooks/usePortalUser'

interface Modulo {
  label: string
  desc: string
  to: string
  hidden?: boolean
}

interface Secretaria {
  id: string
  nombre: string
  responsable?: string
  modulos: Modulo[]
  activa: boolean
  itemsEnDesarrollo?: string[]
}

const SECRETARIAS: Secretaria[] = [
  {
    id: 'vivienda',
    nombre: 'Secretaría de Vivienda',
    activa: true,
    modulos: [
      { label: 'Tablero de Programas', desc: 'KPIs y estado de todos los programas activos', to: '/vivienda/programas' },
      { label: 'Córdoba Hogar', desc: 'Panel provisorio — seguimiento de localidades', to: '/vivienda/cordoba-hogar' },
      { label: 'Cordón Cuneta y Adoquinado', desc: 'Seguimiento de convenios con municipios', to: '/vivienda/cordon-cuneta' },
      { label: 'Registro de Beneficiarios', desc: 'Alta, búsqueda y consulta por DNI', to: '/vivienda/beneficiarios', hidden: true },
      { label: 'Expedientes', desc: 'Tramitación y seguimiento de expedientes', to: '/vivienda/expedientes', hidden: true },
    ],
  },
  {
    id: 'infraestructura',
    nombre: 'Secretaría de Gestión e Infraestructura',
    responsable: 'Luis Molinari',
    activa: false,
    modulos: [],
    itemsEnDesarrollo: ['Infraestructura Eléctrica', 'Agua y Saneamiento'],
  },
  {
    id: 'territorial',
    nombre: 'Sec. de Planificación y Articulación Territorial',
    responsable: 'Gabriel Fizza',
    activa: false,
    modulos: [],
    itemsEnDesarrollo: ['Programa de Fortalecimiento para Cooperativas'],
  },
  {
    id: 'gasifera',
    nombre: 'Secretaría de Infraestructura Gasífera',
    activa: false,
    modulos: [],
    itemsEnDesarrollo: ['Conexión de Gas en Escuelas', 'Asesoramiento Legal y Contable', 'Créditos para Infraestructura'],
  },
  {
    id: 'desarrollo',
    nombre: 'Secretaría de Desarrollo',
    responsable: 'Domingo Benso',
    activa: false,
    modulos: [],
    itemsEnDesarrollo: ['Gestión de Cooperativas (UTN)'],
  },
  {
    id: 'privada',
    nombre: 'Secretaría Privada del Ministro',
    activa: true,
    modulos: [
      { label: 'Gestiones', desc: 'Seguimiento de demandas y expedientes del Ministro', to: '/privada/gestiones' },
      { label: 'Tablero', desc: 'Dashboard y análisis de estadísticas', to: '/privada/tablero' },
    ],
  },
]

function ChevronRight() {
  return (
    <svg
      className="w-4 h-4 flex-shrink-0 transition-colors"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function SecretariaCard({ sec, fullWidth }: { sec: Secretaria; fullWidth?: boolean }) {
  const visibleModulos = sec.modulos.filter((m) => !m.hidden)
  return (
    <section
      aria-label={sec.nombre}
      className={`${fullWidth ? 'md:col-span-2' : ''} bg-white rounded-lg shadow-sm border border-sky-200 overflow-hidden`}
    >
      <div className="bg-gov-navy px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gov-cyan mb-0.5">
            Área disponible
          </p>
          <h3 className="text-white font-semibold">{sec.nombre}</h3>
        </div>
        <span className="text-xs bg-gov-cyan/90 text-white px-2.5 py-1 rounded-full font-medium whitespace-nowrap ml-2 flex-shrink-0">
          {visibleModulos.length} módulo{visibleModulos.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div
        className={`${
          fullWidth
            ? 'grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x'
            : 'divide-y'
        } divide-slate-100`}
      >
        {visibleModulos.map((mod) => (
          <Link
            key={mod.to}
            to={mod.to}
            className="flex items-center gap-4 px-5 py-4 hover:bg-sky-50 transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan focus-visible:outline-offset-[-2px]"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gov-navy group-hover:text-gov-cyan transition-colors">
                {mod.label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{mod.desc}</div>
            </div>
            <span className="text-gray-300 group-hover:text-gov-cyan transition-colors">
              <ChevronRight />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: portalUser, isLoading } = usePortalUser()

  const firstName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0]
  const isAdmin = portalUser?.rol === 'Admin'
  const assigned = portalUser?.secretarias ?? []

  const canSee = (sec: Secretaria) => {
    if (!portalUser) return false
    if (isAdmin) return true
    return assigned.includes(sec.id)
  }

  const visibleActivas = SECRETARIAS.filter((s) => s.activa && canSee(s))
  const visibleDesarrollo = SECRETARIAS.filter((s) => !s.activa && canSee(s))

  // Vivienda siempre va primero y ocupa doble ancho
  const activasOrdenadas = [
    ...visibleActivas.filter((s) => s.id === 'vivienda'),
    ...visibleActivas.filter((s) => s.id !== 'vivienda'),
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gov-navy">Panel de Gestión</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {firstName ? `Bienvenido/a, ${firstName}. ` : ''}
          Seleccioná el área de trabajo.
        </p>
      </div>

      {/* Skeleton mientras carga */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 h-32 bg-white rounded-lg border border-slate-200 animate-pulse" />
          <div className="h-24 bg-white rounded-lg border border-slate-200 animate-pulse" />
        </div>
      )}

      {/* Sin acceso */}
      {!isLoading && portalUser && visibleActivas.length === 0 && visibleDesarrollo.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-6 text-center">
          <p className="text-amber-800 font-medium">Tu cuenta no tiene secretarías asignadas.</p>
          <p className="text-amber-600 text-sm mt-1">
            Contactá al administrador del sistema para que te asigne acceso.
          </p>
        </div>
      )}

      {!isLoading && portalUser && (activasOrdenadas.length > 0 || visibleDesarrollo.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activasOrdenadas.map((sec, idx) => (
            <SecretariaCard
              key={sec.id}
              sec={sec}
              fullWidth={idx === 0 && sec.id === 'vivienda'}
            />
          ))}

          {visibleDesarrollo.map((sec) => (
            <section
              key={sec.id}
              aria-label={sec.nombre}
              className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden opacity-60"
            >
              <div className="bg-slate-500 px-4 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm leading-snug">{sec.nombre}</h3>
                <span className="text-xs bg-white/20 text-white/90 px-2 py-0.5 rounded-full whitespace-nowrap ml-2 flex-shrink-0">
                  En desarrollo
                </span>
              </div>
              <div className="px-4 py-3">
                <ul className="space-y-2" aria-label={`Módulos de ${sec.nombre}`}>
                  {sec.itemsEnDesarrollo?.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                {sec.responsable && (
                  <p className="text-xs text-gray-300 mt-3 pt-2 border-t border-slate-100">
                    Responsable: {sec.responsable}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
