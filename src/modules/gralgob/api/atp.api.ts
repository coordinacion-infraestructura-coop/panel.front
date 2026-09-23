// Panel preliminar de solo lectura sobre el sync del Sheet "ATP - Compromiso
// Gobernador" (spec-sync-atp-compromiso-gobernador.md §12). Dataset moderado
// (~1100 compromisos) — se carga completo, sin paginación en cliente, mismo
// criterio que los paneles de vivienda / el Tablero PIT Gas de gasifera.

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/gralgob'

export interface Compromiso {
  id: string
  departamento: string | null
  localidad: string | null
  ministerio_destino: string | null
  fecha_anuncio: string | null
  nro_expediente: string | null
  derivado: boolean
  monto: number | null
  destino: string | null
  saldo_atp: number | null
  total_pagado: number | null
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

export interface CronogramaPago {
  periodo: string
  monto: number
}

// Padrón geográfico canónico (viv_geo_localidades, propiedad de svc-vivienda,
// ADR-001 database-per-service). Se lee acá vía su endpoint público existente
// (GET /api/v1/vivienda/cordon-cuneta/geo, ya gateado solo por rol — no por
// secretaría — así que un usuario con secretaría "gralgob" también puede
// llamarlo). No se duplica el catálogo en svc-gralgob ni se agrega un
// endpoint nuevo: mismo criterio de "leer read-only, nunca via cross-DB
// join" que usa resumen_territorial con priv_localidades_info (ADR-012),
// aplicado acá del lado del cliente porque no hay ningún endpoint interno
// IAM-only que lo exponga todavía.
export interface GeoLocalidad {
  id_geo: string
  departamento: string
  localidad: string
  activo: boolean
}

export const atpApi = {
  compromisos: () =>
    apiClient
      .get<{ items: Compromiso[]; total: number }>(`${BASE}/compromisos`, { params: { limit: 1500 } })
      .then((r) => r.data),
  cronograma: (compromisoId: string) =>
    apiClient.get<CronogramaPago[]>(`${BASE}/compromisos/${compromisoId}/cronograma`).then((r) => r.data),
  syncEstado: () =>
    apiClient.get<SyncEstado | null>(`${BASE}/sync-estado`).then((r) => r.data),
  geoLocalidades: () =>
    apiClient.get<GeoLocalidad[]>('/api/v1/vivienda/cordon-cuneta/geo').then((r) => r.data),
}
