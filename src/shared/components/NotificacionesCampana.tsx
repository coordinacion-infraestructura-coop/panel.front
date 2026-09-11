import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notificacionesApi } from '../../modules/notificaciones/api/notificaciones.api'
import { usePortalUser } from '../hooks/usePortalUser'

/**
 * Campana en la barra superior con el contador de notificaciones no leídas.
 * Poll cada 60 s (mismo patrón que el estado de sync de Cordón Cuneta). Un click
 * lleva a la página `/notificaciones`.
 */
export function NotificacionesCampana() {
  const navigate = useNavigate()
  const { data: portalUser } = usePortalUser()

  const { data } = useQuery({
    queryKey: ['notificaciones-contador'],
    queryFn: notificacionesApi.contarNoLeidas,
    refetchInterval: 60_000,
    enabled: !!portalUser,
  })

  if (!portalUser) return null

  const n = data?.no_leidas ?? 0
  const badge = n > 9 ? '9+' : String(n)

  return (
    <button
      onClick={() => navigate('/notificaciones')}
      aria-label={n > 0 ? `Notificaciones: ${n} sin leer` : 'Notificaciones'}
      className="relative flex items-center justify-center h-8 w-8 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan cursor-pointer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
        />
      </svg>
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gov-orange text-white text-[10px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}
