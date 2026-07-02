export interface Gestion {
  id_gestion: string
  nro_expediente?: string | null
  estado: string
  estado_nombre?: string
  fecha_ingreso: string
  fecha_estado?: string
  urgencia?: string
  ministerio_agencia_id?: string
  ministerio_nombre?: string
  categoria_general_id?: string
  categoria_nombre?: string
  detalle: string
  departamento: string
  localidad: string
  direccion?: string
  canal_origen?: string
  tipo_gestion?: string
  created_at?: string
  created_by?: string
}

export interface GestionDetalle extends Gestion {
  origen?: string
  observaciones?: string
  subtipo_detalle?: string
  costo_estimado?: number
  costo_moneda?: string
  lat?: number
  lon?: number
  updated_at?: string
  updated_by?: string
  is_deleted?: boolean
}

export interface GestionesResponse {
  items: Gestion[]
  total: number
  limit: number
  offset: number
}

export interface CatalogoItem {
  id: string
  nombre: string
  orden?: number
  activo?: boolean
}

export interface Evento {
  id_evento: string
  id_gestion: string
  fecha_evento: string
  usuario: string
  rol_usuario?: string
  tipo_evento: string
  estado_anterior?: string
  estado_nuevo?: string
  campo_modificado?: string
  valor_anterior?: string
  valor_nuevo?: string
  comentario?: string
  metadata_json?: string
}

export type EstadoGestion =
  | 'INGRESADO'
  | 'DERIVADO A SUAC'
  | 'LISTA PARA INNAUGURAR'
  | 'FINALIZADA'
  | 'NO REMITE SUAC'
  | 'ARCHIVADO'

export interface CambioEstadoPayload {
  nuevo_estado: EstadoGestion
  comentario?: string
  nro_expediente?: string
  fecha_ingreso?: string
  derivado_a?: string
  acciones_implementadas?: string
}

export interface MeResponse {
  email: string
  nombre?: string
  rol: string
  modulos: string[]
}
