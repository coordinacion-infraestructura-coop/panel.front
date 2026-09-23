// Panel preliminar de solo lectura sobre el sync del Sheet "SEC. GAS PIT"
// (spec-sync-gasifera-pit.md §12). Datasets chicos (~17 obras + ~299 acciones) —
// se cargan completos, sin paginación en cliente, mismo criterio que los paneles
// de vivienda.

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/gasifera'

export interface ObraGas {
  id: string
  spip: string | null
  expediente: string | null
  division: string | null
  nombre_obra: string
  tipo_obra: string | null
  sub_tipo_obra: string
  contratista: string | null
  estado_obra: string | null
  estado_resumen: string | null
  departamento: string | null
  localidades: string[]
  avance: number | null
  repla_inicial: string | null
  fecha_lic: string | null
  vencimiento: string | null
  plazo_vigente_dias: number | null
  plazo_original: number | null
  contrato_base: number | null
  ampliacion: number | null
  enmienda: number | null
  importe_obra_actualizado: number | null
  importe_dolar: number | null
  prioridad: string | null
  categoria: number | null
  region: string | null
  autorizada_2025: string | null
  pit: boolean
  last_synced_at: string
}

export interface AccionTerritorio {
  id: string
  fecha: string | null
  departamento: string | null
  localidad: string | null
  ministerio: string | null
  area: string | null
  id_accion: string | null
  accion: string | null
  detalle_accion: string | null
  estado: string
  monto_inversion_solicitado: number | null
  comentarios: string | null
  monto_inversion_usd: number | null
  alerta_localidad: string | null
  last_synced_at: string
}

export interface SyncEstado {
  started_at: string
  finished_at: string | null
  filas_leidas: number
  filas_insertadas: number
  filas_actualizadas: number
  filas_error: number
  triggered_by: string | null
}

export const gasiferaPitApi = {
  obras: () =>
    apiClient
      .get<{ items: ObraGas[]; total: number }>(`${BASE}/obras`, { params: { limit: 500 } })
      .then((r) => r.data),
  accionesTerritorio: () =>
    apiClient
      .get<{ items: AccionTerritorio[]; total: number }>(`${BASE}/acciones-territorio`, {
        params: { limit: 1000 },
      })
      .then((r) => r.data),
  syncEstado: () =>
    apiClient.get<SyncEstado | null>(`${BASE}/sync-estado`).then((r) => r.data),
}
