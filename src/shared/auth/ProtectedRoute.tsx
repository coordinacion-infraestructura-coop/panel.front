import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { usePortalUser } from '../hooks/usePortalUser'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Si se especifica, además de estar autenticado el usuario debe tener uno de estos roles (según /portal/me). */
  roles?: string[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const portalQuery = usePortalUser()

  const checkingRole = !!roles && !!user && portalQuery.isLoading

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-cyan" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(portalQuery.data?.rol ?? '')) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
