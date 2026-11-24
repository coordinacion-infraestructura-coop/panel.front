// Planificación de programas por localidad (svc-privada, ADR-036,
// docs/files/spec-privada-planificacion-programas.md §7). Prefijo /api/v1/privada/planificacion.

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/privada/planificacion'

export const AREAS_PROGRAMA = [
  { id: 'vivienda', label: 'Vivienda' },
  { id: 'gasifera', label: 'Sec. Gasífera' },
  { id: 'gralgob', label: 'Sec. Gral. de Gobierno' },
  { id: 'privada', label: 'Sec. Privada' },
  { id: 'otra', label: 'Otra' },
] as const

export const FUENTES_PROGRAMA = [
  { id: 'cordon_cuneta', label: 'Cordón Cuneta (Vivienda)' },
  { id: 'cordoba_hogar', label: 'Córdoba Hogar (Vivienda)' },
  { id: 'mi_lugar', label: 'Mi Lugar (Vivienda)' },
  { id: 'gas_pit', label: 'Gasífera — PIT' },
  { id: 'atp', label: 'ATP (Sec. Gral. de Gobierno)' },
] as const

export const TIPOS_COLUMNA = [
  { id: 'texto', label: 'Texto corto' },
  { id: 'texto_largo', label: 'Texto largo' },
  { id: 'numero', label: 'Número' },
  { id: 'monto', label: 'Monto ($)' },
  { id: 'si_no', label: 'Sí / No' },
  { id: 'fecha', label: 'Fecha' },
  { id: 'lista', label: 'Lista de opciones' },
] as const

export type TipoColumna = (typeof TIPOS_COLUMNA)[number]['id']

export interface Programa {
  id: number
  nombre: string
  area: string
  fuente: string | null
  descripcion: string | null
  orden: number
  activo: boolean
}

export interface Estado {
  id: number
  programa_id: number
  nombre: string
  color_bg: string | null
  color_texto: string | null
  orden: number
  eliminado: boolean
}

export interface Prioridad extends Estado {
  codigo: string
  excluye: boolean
}

export interface Columna {
  id: number
  programa_id: number
  clave: string
  nombre: string
  tipo: TipoColumna
  opciones: string[] | null
  orden: number
  visible: boolean
  eliminado: boolean
}

export interface LineaPanel {
  estado_general?: { label: string; bg: string | null; text_color: string | null } | null
  ok_gob?: boolean | null
  convenio_firmado?: boolean | null
  fecha_firma_convenio?: string | null
  monto?: number | null
}

export interface FilaPlan {
  id_geo: string
  departamento: string
  localidad: string
  tipo_localidad: string | null
  habitantes: number | null
  semaforo: string | null
  /** Género del intendente o intendenta: F/M. `nombre` = deducido, no es el dato oficial 2023. */
  intendente_sexo: 'F' | 'M' | null
  intendente_sexo_origen: 'eleccion_2023' | 'nombre' | null
  prioridad_id: number | null
  estado_id: number | null
  ok_gobernador: boolean | null
  valores: Record<string, unknown>
  updated_at: string | null
  cambios: number
  en_panel: { estado: 'si' | 'no' | 'sin_dato'; lineas: LineaPanel[] } | null
  convenio: { firmado: boolean; fecha: string | null } | null
  ok_gobernador_panel: boolean | null
  visita_gobernador: { visitada: boolean; fecha_ultima: string | null } | null
  coparticipacion_anual: { monto: number; meses: number; desde?: string; hasta?: string; meses_ventana?: number } | null
}

export interface Planilla {
  total: number
  items: FilaPlan[]
  fuentes: Record<string, string>
}

export interface CambioFila {
  updated_at: string | null
  prioridad_id?: number | null
  estado_id?: number | null
  ok_gobernador?: boolean | null
  valores?: Record<string, unknown>
}

export interface FilaGuardada {
  id_geo: string
  prioridad_id: number | null
  estado_id: number | null
  ok_gobernador: boolean | null
  valores: Record<string, unknown>
  updated_at: string | null
  cambios: number
}

export interface CambioHistorial {
  id: number
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  usuario: string | null
  fecha: string
}

export type Catalogo = 'estados' | 'prioridades' | 'columnas'

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const planificacionApi = {
  programas: (incluirInactivos = false) =>
    data<Programa[]>(apiClient.get(`${BASE}/programas`, { params: { incluir_inactivos: incluirInactivos } })),
  crearPrograma: (body: Partial<Programa>) => data<Programa>(apiClient.post(`${BASE}/programas`, body)),
  editarPrograma: (id: number, body: Partial<Programa>) => data<Programa>(apiClient.patch(`${BASE}/programas/${id}`, body)),
  borrarPrograma: (id: number) => data<{ ok: boolean }>(apiClient.delete(`${BASE}/programas/${id}`)),

  catalogo: <T,>(programaId: number, cat: Catalogo, incluirEliminados = false) =>
    data<T[]>(apiClient.get(`${BASE}/programas/${programaId}/${cat}`, { params: { incluir_eliminados: incluirEliminados } })),
  crearItem: (programaId: number, cat: Catalogo, body: Record<string, unknown>) =>
    data<unknown>(apiClient.post(`${BASE}/programas/${programaId}/${cat}`, body)),
  editarItem: (programaId: number, cat: Catalogo, id: number, body: Record<string, unknown>) =>
    data<unknown>(apiClient.patch(`${BASE}/programas/${programaId}/${cat}/${id}`, body)),
  borrarItem: (programaId: number, cat: Catalogo, id: number) =>
    data<{ ok: boolean }>(apiClient.delete(`${BASE}/programas/${programaId}/${cat}/${id}`)),

  planilla: (programaId: number) =>
    data<Planilla>(apiClient.get(`${BASE}/programas/${programaId}/localidades`, { params: { limit: 1000 } })),
  guardarFila: (programaId: number, idGeo: string, body: CambioFila) =>
    data<FilaGuardada>(apiClient.patch(`${BASE}/programas/${programaId}/localidades/${encodeURIComponent(idGeo)}`, body)),
  historial: (programaId: number, idGeo: string) =>
    data<CambioHistorial[]>(
      apiClient.get(`${BASE}/programas/${programaId}/localidades/${encodeURIComponent(idGeo)}/historial`, { params: { limit: 200 } }),
    ),
}

/** Mensaje legible de un error del backend ({detail: {code, message}} o string). */
export function mensajeError(err: unknown, fallback = 'No se pudo guardar.'): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message)
  if (typeof detail === 'string') return detail
  if (status === 403) return 'No tenés permisos para esta acción.'
  return fallback
}

export function codigoError(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return detail && typeof detail === 'object' && 'code' in detail ? String((detail as { code: unknown }).code) : null
}

/** "Mujer" / "Varón" (con "*" si se dedujo del nombre), o '' si no hay dato. */
export function generoIntendente(f: Pick<FilaPlan, 'intendente_sexo' | 'intendente_sexo_origen'>): string {
  if (!f.intendente_sexo) return ''
  return (f.intendente_sexo === 'F' ? 'Mujer' : 'Varón') + (f.intendente_sexo_origen === 'nombre' ? ' *' : '')
}
