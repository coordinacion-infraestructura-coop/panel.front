// Ficha de localidad (E5b) — demografía de padrón público de la Secretaría Privada.
// Se consulta on-demand al abrir la ficha (no se embebe en el snapshot; 551 localidades).
// El backend `resumen_territorial` (svc-vivienda) no llama a svc-privada server-to-server
// todavía (E5a / ADR-016 pendiente), así que el frontend trae la ficha con el token del
// usuario — read-only, ADR-012.

import apiClient from '../../../shared/api/client'

export interface LocalidadInfo {
  departamento: string
  localidad: string
  habitantes: number | null
  electores: number | null
  intendente_jefe_comunal: string | null
  partido_politico: string | null
  tipo_localidad: string | null
  color_semaforo: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface DepartamentoInfo {
  departamento: string
  habitantes: number | null
  electores: number | null
  legislador_departamental: string | null
  partido_politico: string | null
  legislador_sabana1: string | null
  partido_politico_sabana1: string | null
  legislador_sabana2: string | null
  partido_politico_sabana2: string | null
  updated_at: string | null
  updated_by: string | null
}

export const fichaLocalidadApi = {
  localidad: (departamento: string, localidad: string) =>
    apiClient
      .get<LocalidadInfo>('/api/v1/privada/localidades-info', { params: { departamento, localidad } })
      .then((r) => r.data),
  departamento: (departamento: string) =>
    apiClient
      .get<DepartamentoInfo>('/api/v1/privada/departamentos-info', { params: { departamento } })
      .then((r) => r.data),
}
