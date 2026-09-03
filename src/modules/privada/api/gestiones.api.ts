import apiClient from '../../../shared/api/client'
import type { CambioEstadoPayload, GestionCreatePayload, MeResponse } from '../types/gestiones.types'

const BASE = '/api/v1/privada'

export interface GestionesParams {
  q?: string
  estado?: string
  ministerio?: string
  categoria?: string
  tipo_gestion?: string
  canal_origen?: string
  departamento?: string
  localidad?: string
  ok_gobernador?: string
  ok_ministro?: string
  categoria_id?: number
  programa_id?: number
  area_id?: number
  sort?: string
  sort_dir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export const gestionesApi = {
  list: (params: GestionesParams = {}) =>
    apiClient.get(`${BASE}/gestiones`, { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get(`${BASE}/gestiones/${id}`).then((r) => r.data),

  crear: (payload: GestionCreatePayload) =>
    apiClient.post(`${BASE}/gestiones`, payload).then((r) => r.data),

  getEventos: (id: string) =>
    apiClient.get(`${BASE}/gestiones/${id}/eventos`).then((r) => r.data),

  cambiarEstado: (id: string, payload: CambioEstadoPayload) =>
    apiClient.post(`${BASE}/gestiones/${id}/cambiar-estado`, payload).then((r) => r.data),

  eliminar: (id: string) =>
    apiClient.delete(`${BASE}/gestiones/${id}`).then((r) => r.data),

  catalogo: (nombre: string) =>
    apiClient.get(`${BASE}/catalogos/${nombre}`).then((r) => r.data),

  catalogoLocalidades: (departamento: string) =>
    apiClient.get(`${BASE}/catalogos/localidades`, { params: { departamento } }).then((r) => r.data),

  me: (): Promise<MeResponse> =>
    apiClient.get(`${BASE}/me`).then((r) => r.data),
}
