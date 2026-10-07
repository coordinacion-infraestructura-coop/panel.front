import apiClient from '../../../shared/api/client'
import type {
  DeshacerOut,
  EstadoPendiente,
  GeoPendientesResponse,
  ResolverPendienteIn,
  ResolverPendienteOut,
} from '../types/geoPendientes.types'

const BASE = '/api/v1/geo'

export interface ListarPendientesParams {
  estado?: EstadoPendiente
  origen?: string
  limit?: number
  offset?: number
}

export const geoPendientesApi = {
  list: (params: ListarPendientesParams = {}) =>
    apiClient.get<GeoPendientesResponse>(`${BASE}/pendientes`, { params }).then((r) => r.data),
  resolver: (id: string, data: ResolverPendienteIn) =>
    apiClient.post<ResolverPendienteOut>(`${BASE}/pendientes/${id}/resolver`, data).then((r) => r.data),
  descartar: (id: string) =>
    apiClient.post(`${BASE}/pendientes/${id}/descartar`).then((r) => r.data),
  deshacer: (id: string) =>
    apiClient.post<DeshacerOut>(`${BASE}/pendientes/${id}/deshacer`).then((r) => r.data),
}
