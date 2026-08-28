import apiClient from '../../../shared/api/client'
import type { ResumenSnapshot } from '../types/resumenTerritorial.types'

const BASE = '/api/v1/resumen-territorial'

export const resumenTerritorialApi = {
  // Devuelve null si todavía no se calculó ningún snapshot.
  getResumen: () =>
    apiClient.get<ResumenSnapshot | null>(BASE).then((r) => r.data),

  actualizarResumen: () =>
    apiClient.post<ResumenSnapshot>(`${BASE}/actualizar`).then((r) => r.data),
}
