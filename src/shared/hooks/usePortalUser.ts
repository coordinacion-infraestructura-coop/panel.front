import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'

export interface PortalUser {
  email: string
  nombre?: string
  rol: 'Admin' | 'Supervisor' | 'Operador' | 'Consulta' | 'TecnicoDGV'
  secretarias: string[]
}

/**
 * @param enabled Por defecto true. `ProtectedRoute` lo llama antes de que Firebase
 * termine de resolver la sesión (mientras `loading` todavía es true) — pasar
 * `enabled: false` en ese caso evita disparar la request sin token todavía
 * (que volvía como 401 "Jwt is missing", sin headers CORS en la respuesta de
 * error del gateway).
 */
export function usePortalUser(enabled = true) {
  return useQuery<PortalUser>({
    queryKey: ['portal-me'],
    queryFn: () => apiClient.get('/api/v1/portal/me').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled,
  })
}
