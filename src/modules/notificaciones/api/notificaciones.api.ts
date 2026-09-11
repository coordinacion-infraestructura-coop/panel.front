import apiClient from '../../../shared/api/client'
import type { NotificacionesListResponse } from '../types/notificaciones.types'

const BASE = '/api/v1/notificaciones'

export interface ListarParams {
  solo_no_leidas?: boolean
  limit?: number
  offset?: number
}

export const notificacionesApi = {
  list: (params: ListarParams = {}) =>
    apiClient.get<NotificacionesListResponse>(BASE, { params }).then((r) => r.data),
  contarNoLeidas: () =>
    apiClient.get<{ no_leidas: number }>(`${BASE}/no-leidas/contar`).then((r) => r.data),
  marcarLeida: (id: string) =>
    apiClient.post(`${BASE}/${id}/marcar-leida`).then((r) => r.data),
  marcarTodasLeidas: () =>
    apiClient.post(`${BASE}/marcar-todas-leidas`).then((r) => r.data),
}
