import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePortalUser } from '../hooks/usePortalUser'

interface NavItem {
  to: string
  label: string
}

const SECRETARIA_NAV: Record<string, NavItem[]> = {
  vivienda: [
    { to: '/vivienda/programas', label: 'Tablero' },
    { to: '/vivienda/cordoba-hogar', label: 'Córdoba Hogar' },
    { to: '/vivienda/cordon-cuneta', label: 'Cordón Cuneta' },
    // { to: '/vivienda/beneficiarios', label: 'Beneficiarios' }, // oculto — módulo en desarrollo
    // { to: '/vivienda/expedientes', label: 'Expedientes' },     // oculto — módulo en desarrollo
  ],
  privada: [
    { to: '/privada/gestiones', label: 'Gestiones' },
    { to: '/privada/tablero', label: 'Tablero' },
  ],
}

const SECRETARIA_LABEL: Record<string, string> = {
  vivienda: 'Sec. Vivienda',
  privada: 'Sec. Privada',
}

function getActiveSecretaria(pathname: string): string | null {
  if (pathname.startsWith('/vivienda')) return 'vivienda'
  if (pathname.startsWith('/privada')) return 'privada'
  return null
}

export function Layout() {
  const { user, logout } = useAuth()
  const { data: portalUser } = usePortalUser()
  const location = useLocation()

  const activeSecretaria = getActiveSecretaria(location.pathname)
  const navItems = activeSecretaria ? (SECRETARIA_NAV[activeSecretaria] ?? []) : []
  const isAdmin = portalUser?.rol === 'Admin'
  const isAdminPage = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Franja cyan superior */}
      <div className="h-1 bg-gov-cyan" aria-hidden="true" />

      <header className="bg-gov-navy text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan focus-visible:outline-offset-2 rounded"
          >
            <img src="/heraldico.png" alt="" aria-hidden="true" className="h-10 w-auto flex-shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-gov-cyan uppercase tracking-widest mb-0.5">
                Provincia de Córdoba
              </p>
              <h1 className="text-base font-semibold leading-tight">
                Ministerio de Cooperativas y Mutuales
              </h1>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {portalUser ? (
              <span className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-white/60 truncate max-w-[160px]">
                  {user?.displayName || user?.email}
                </span>
                <span className="text-[10px] bg-gov-cyan/20 text-gov-cyan border border-gov-cyan/30 px-2 py-0.5 rounded-full font-medium">
                  {portalUser.rol}
                </span>
              </span>
            ) : (
              <span className="hidden sm:block text-xs text-white/60 truncate max-w-[200px]">
                {user?.displayName || user?.email}
              </span>
            )}
            <button
              onClick={logout}
              className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
            >
              Salir
            </button>
          </div>
        </div>

        <nav className="bg-[#1e3a52] border-t border-white/10" aria-label="Navegación principal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] sm:[mask-image:none]">
            {/* Inicio siempre visible */}
            <Link
              to="/"
              aria-current={location.pathname === '/' ? 'page' : undefined}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan ${
                location.pathname === '/'
                  ? 'border-gov-cyan text-white'
                  : 'border-transparent text-white/65 hover:text-white hover:border-white/30'
              }`}
            >
              Inicio
            </Link>

            {/* Módulos de la secretaría activa */}
            {activeSecretaria && (
              <>
                <span
                  className="flex items-center px-3 text-white/25 text-xs select-none"
                  aria-hidden="true"
                >
                  {SECRETARIA_LABEL[activeSecretaria] ?? activeSecretaria} /
                </span>
                {navItems.map(({ to, label }) => {
                  const active = location.pathname.startsWith(to)
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
              </>
            )}

            {/* Administración — solo para Admin */}
            {isAdmin && (
              <Link
                to="/admin/usuarios"
                aria-current={isAdminPage ? 'page' : undefined}
                className={`flex-shrink-0 ml-auto px-4 py-3 text-sm font-medium transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan ${
                  isAdminPage
                    ? 'border-gov-cyan text-white'
                    : 'border-transparent text-white/50 hover:text-white hover:border-white/30'
                }`}
              >
                Administración
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
