import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { usePortalUser } from '../hooks/usePortalUser'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Si se especifica, además de estar autenticado el usuario debe tener uno de estos roles (según /portal/me). */
  roles?: string[]
  /** Si se especifica, además de estar autenticado el usuario debe tener una de estas secretarías en su lista. */
  requiredSecretarias?: string[]
}

export function ProtectedRoute({ children, roles, requiredSecretarias }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const portalQuery = usePortalUser(!loading && !!user)

  const checkingRole = !!(roles || requiredSecretarias) && !!user && portalQuery.isLoading

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-cyan" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const userRol = portalQuery.data?.rol ?? ''
  const userSecretarias = portalQuery.data?.secretarias ?? []

  // Chequear acceso basado en roles y/o secretarías
  let hasAccess = true

  if (roles || requiredSecretarias) {
    const hasRole = roles && roles.includes(userRol)
    const hasSecretaria = requiredSecretarias && requiredSecretarias.some((sec) =>
      userSecretarias.some((userSec) => userSec.toLowerCase() === sec.toLowerCase())
    )

    // Si se especifican ambos, es OR (basta cumplir una); si solo uno, se valida ese
    if (roles && requiredSecretarias) {
      hasAccess = hasRole || hasSecretaria
    } else if (roles) {
      hasAccess = hasRole
    } else if (requiredSecretarias) {
      hasAccess = hasSecretaria
    }
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

