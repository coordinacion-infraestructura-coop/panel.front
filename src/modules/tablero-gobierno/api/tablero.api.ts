// Tablero de Gobierno — reemplazo del Looker "Tablero - Min. de Gobierno"
// (spec-tablero-gobierno-panel.md, ADR-028). Lo sirve svc-datos-externos; todo el
// tablero es solo para Admin y Autoridad (el backend responde 403 al resto).

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/datos-externos/tablero'

export interface LocalidadFiltro {
  id_geo: string | null
  codigo_indec: string
  nombre: string
  departamento: string
  tipo: 'Municipio' | 'Comuna' | null
}

export interface FuenteFrescura {
  fuente: string
  etiqueta: string
  estado: 'ok' | 'parcial' | 'fallido' | 'sin_datos'
  ultima_corrida: string | null
  ultimo_periodo: string | null
  detalle: string | null
}

export interface TableroMeta {
  localidades: LocalidadFiltro[]
  anios: number[]
  frescura: FuenteFrescura[]
}

export const tableroApi = {
  meta: (): Promise<TableroMeta> => apiClient.get(`${BASE}/meta`).then((r) => r.data),
}
