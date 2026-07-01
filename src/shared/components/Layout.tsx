import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface NavItem {
  to: string
  label: string
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', exact: true },
  { to: '/vivienda/programas', label: 'Programas' },
  { to: '/vivienda/beneficiarios', label: 'Beneficiarios' },
  { to: '/vivienda/expedientes', label: 'Expedientes' },
  { to: '/vivienda/cordon-cuneta', label: 'Cordón Cuneta' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Franja cyan superior */}
      <div className="h-1 bg-gov-cyan" aria-hidden="true" />

      <header className="bg-gov-navy text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan focus-visible:outline-offset-2 rounded">
            <p className="text-[10px] font-medium text-gov-cyan uppercase tracking-widest mb-0.5">
              Provincia de Córdoba
            </p>
            <h1 className="text-base font-semibold leading-tight">
              Ministerio de Cooperativas y Mutuales
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-white/60 truncate max-w-[200px]">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={logout}
              className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
            >
              Salir
            </button>
          </div>
        </div>

        <nav
          className="bg-[#1e3a52] border-t border-white/10"
          aria-label="Navegación principal"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto">
            {NAV_ITEMS.map(({ to, label, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan ${
                    active
                      ? 'border-gov-cyan text-white'
                      : 'border-transparent text-white/65 hover:text-white hover:border-white/30'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
