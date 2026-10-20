// Tablero de Gobierno — reemplazo del Looker "Tablero - Min. de Gobierno"
// (spec-tablero-gobierno-panel.md, ADR-028). Lo sirven svc-datos-externos (transferencias,
// inicio) y svc-gralgob (ATP). Todo el tablero es solo para Admin y Autoridad: el backend
// responde 403 al resto.

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

export interface InicioDepartamento {
  departamento: string
  localidades: number
  poblacion: number
  transferido: number
  por_habitante: number | null
}

export interface Inicio {
  anio: number
  periodo_hasta: string | null
  kpis: {
    localidades: number
    municipios: number
    comunas: number
    poblacion: number
    transferido: number
    por_habitante: number | null
  }
  por_departamento: InicioDepartamento[]
}

export interface Transferencias {
  concepto: string
  etiqueta: string
  anio: number
  ultimo_periodo: string | null
  total_anio: number
  acumulado_anterior: number | null
  variacion: number | null
  ultimo_mes: number | null
  mensual: (number | null)[]
  mensual_anterior: (number | null)[]
  por_concepto: { concepto: string; etiqueta: string; monto: number }[]
  localidades: number
}

export interface AtpGrupo {
  clave: string
  cantidad: number
  monto: number
  pagado: number
}

export interface AtpFila {
  id: string
  fecha_anuncio: string | null
  departamento: string | null
  localidad: string | null
  id_geo: string | null
  ministerio: string | null
  destino: string | null
  nro_expediente: string | null
  derivado: boolean
  monto: number | null
  pagado: number
  estado: 'Pagado' | 'Parcial' | 'Pendiente' | 'Sin dato'
}

export interface AtpCompromisos {
  kpis: { localidades: number; compromisos: number; derivados: number; monto: number; pagado: number; saldo: number }
  por_ministerio: AtpGrupo[]
  por_estado: AtpGrupo[]
  por_departamento: AtpGrupo[]
  filas: AtpFila[]
  ultima_sincronizacion: string | null
  estado_sincronizacion: 'ok' | 'con_errores' | 'en_curso' | 'sin_datos'
}

/** FastAPI espera listas como parámetros repetidos (`codigo_indec=a&codigo_indec=b`), no el
 * `codigo_indec[]=` que arma axios por defecto. */
function params(base: Record<string, string | number>, lista?: { clave: string; valores: string[] | undefined }) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) p.append(k, String(v))
  for (const v of lista?.valores ?? []) p.append(lista!.clave, v)
  return p
}

export const tableroApi = {
  meta: (): Promise<TableroMeta> => apiClient.get(`${BASE}/meta`).then((r) => r.data),
  inicio: (anio: number, codigos?: string[]): Promise<Inicio> =>
    apiClient.get(`${BASE}/inicio`, { params: params({ anio }, { clave: 'codigo_indec', valores: codigos }) }).then((r) => r.data),
  transferencias: (seccion: 'coparticipacion' | 'fofindes', anio: number, codigos?: string[]): Promise<Transferencias> =>
    apiClient
      .get(`${BASE}/transferencias/${seccion}`, { params: params({ anio }, { clave: 'codigo_indec', valores: codigos }) })
      .then((r) => r.data),
  atpCompromisos: (idsGeo?: string[]): Promise<AtpCompromisos> =>
    apiClient
      .get('/api/v1/gralgob/tablero/atp-compromisos', { params: params({}, { clave: 'id_geo', valores: idsGeo }) })
      .then((r) => r.data),
}
