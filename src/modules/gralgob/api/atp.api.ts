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

export const atpApi = {
  compromisos: () =>
    apiClient
      .get<{ items: Compromiso[]; total: number }>(`${BASE}/compromisos`, { params: { limit: 1500 } })
      .then((r) => r.data),
  syncEstado: () =>
    apiClient.get<SyncEstado | null>(`${BASE}/sync-estado`).then((r) => r.data),
}
