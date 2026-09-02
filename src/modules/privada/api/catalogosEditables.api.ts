// Catálogos editables de Privada (E1 / ADR-010) — categorías, programas, áreas.
// CRUD desde el panel de administración; GET para poblar los desplegables del alta/edición.

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/privada'

export type CatalogoNombre = 'categorias' | 'programas' | 'areas'

export interface CatEditable {
  id: number
  label: string
  orden: number
  activo: boolean
  bg?: string | null
  text_color?: string | null
  codigo?: string | null
  es_centinela?: boolean
}

export interface CatEditableIn {
  label: string
  orden?: number
  activo?: boolean
  bg?: string | null
  text_color?: string | null
  codigo?: string | null
  es_centinela?: boolean
}

export const catalogosEditablesApi = {
  list: (nombre: CatalogoNombre, incluirInactivos = false): Promise<CatEditable[]> =>
    apiClient
      .get(`${BASE}/${nombre}`, { params: incluirInactivos ? { incluir_inactivos: true } : {} })
      .then((r) => r.data),
  crear: (nombre: CatalogoNombre, body: CatEditableIn): Promise<CatEditable> =>
    apiClient.post(`${BASE}/${nombre}`, body).then((r) => r.data),
  actualizar: (nombre: CatalogoNombre, id: number, body: Partial<CatEditableIn>): Promise<CatEditable> =>
    apiClient.patch(`${BASE}/${nombre}/${id}`, body).then((r) => r.data),
  eliminar: (nombre: CatalogoNombre, id: number) =>
    apiClient.delete(`${BASE}/${nombre}/${id}`).then((r) => r.data),
}
