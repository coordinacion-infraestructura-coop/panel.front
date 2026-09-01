// Tablero nativo (spec-privada-tablero.md / ADR-014) — reemplazo del iframe Looker.
// Consume los 4 endpoints de agregación que ya porta svc-privada, sobre db_privada.

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/privada/informe/cooperativas'

export interface ResumenTema {
  tema: string
  total: number
  finalizadas: number
  en_curso: number
  archivadas: number
  urgentes: number
}
export interface InformeResumen {
  total: number
  fecha_desde: string
  fecha_hasta: string
  por_tema: ResumenTema[]
}
export interface TemporalPunto {
  mes: string
  tema: string | null
  total: number
}
export interface DepartamentoPunto {
  tema: string | null
  departamento: string | null
  total: number
  finalizadas: number
}
export interface GestionPunto {
  id_gestion: string
  tema: string | null
  es_ministerio_cooperativas: boolean
  estado: string | null
  urgencia: string | null
  departamento: string | null
  localidad: string | null
  fecha_ingreso: string | null
  detalle_corto: string | null
  nro_expediente: string | null
  lat: number | null
  lon: number | null
}

export interface InformeParams {
  fecha_desde?: string
  fecha_hasta?: string
  tema?: string
}

export const informeApi = {
  resumen: (p: InformeParams = {}) =>
    apiClient.get<InformeResumen>(`${BASE}/resumen`, { params: p }).then((r) => r.data),
  temporal: (p: InformeParams = {}) =>
    apiClient.get<TemporalPunto[]>(`${BASE}/temporal`, { params: p }).then((r) => r.data),
  porDepartamento: (p: InformeParams = {}) =>
    apiClient.get<DepartamentoPunto[]>(`${BASE}/por-departamento`, { params: p }).then((r) => r.data),
  puntos: (p: InformeParams = {}) =>
    apiClient.get<GestionPunto[]>(`${BASE}/puntos`, { params: p }).then((r) => r.data),
}
