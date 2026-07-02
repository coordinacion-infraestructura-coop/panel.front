import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'

export interface PortalUser {
  email: string
  nombre?: string
  rol: 'Admin' | 'Supervisor' | 'Operador' | 'Consulta'
  secretarias: string[]
}

export function usePortalUser() {
  return useQuery<PortalUser>({
    queryKey: ['portal-me'],
    queryFn: () => apiClient.get('/api/v1/portal/me').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
