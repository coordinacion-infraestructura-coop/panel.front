export interface Programa {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  activo: boolean
  requiere_ingreso_max: boolean
  ingreso_max: number | null
  created_at: string
  updated_at: string
}

export interface Beneficiario {
  id: string
  dni: string
  cuil: string | null
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  domicilio_calle: string | null
  domicilio_numero: string | null
  domicilio_localidad: string | null
  domicilio_departamento: string | null
  grupo_familiar_count: number | null
  ingreso_mensual: number | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface BeneficiarioCreate {
  dni: string
  nombre: string
  apellido: string
  cuil?: string
  email?: string | null
  telefono?: string
  fecha_nacimiento?: string
  domicilio_calle?: string
  domicilio_numero?: string
  domicilio_localidad?: string
  domicilio_departamento?: string
  grupo_familiar_count?: number
  ingreso_mensual?: number
}

export type EstadoExpediente =
  | 'INGRESADO'
  | 'EN_EVALUACION'
  | 'DOCS_PENDIENTE'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'EN_LISTA_ESPERA'
  | 'ASIGNADO'
  | 'BAJA'

export interface Expediente {
  id: string
  numero: string
  beneficiario_id: string
  beneficiario?: Beneficiario
  programa_id: string
  programa?: Programa
  estado: EstadoExpediente
  fecha_ingreso: string
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface EstadoCC {
  id: number
  label: string
  bg: string
  text_color: string
  orden: number
}

export interface MunicipioCC {
  id: string
  orden: number
  municipio: string
  departamento: string | null
  expediente: string | null
  monto: number | null
  ok_gob: string
  doc_exp: string | null
  ejuridico: number | null
  etecnico: number | null
  efinanciero: number | null
  cordon_cuneta_ml: number | null
  adoquinado_m2: number | null
  obs: string | null
  updated_at: string
  updated_by: string | null
}

export interface CordonCunetaPanel {
  municipios: MunicipioCC[]
  estados: EstadoCC[]
  presupuesto: number
}

export interface PedidoCC {
  id: string
  municipio_id: string
  descripcion: string
  fecha_pedido: string
  created_at: string
  created_by: string | null
}

export interface PedidoCCCreate {
  descripcion: string
  fecha_pedido: string
}

export interface MunicipioCCUpdate {
  municipio?: string
  departamento?: string
  expediente?: string
  monto?: number | null
  ok_gob?: string
  doc_exp?: string
  ejuridico?: number | null
  etecnico?: number | null
  efinanciero?: number | null
  cordon_cuneta_ml?: number | null
  adoquinado_m2?: number | null
  obs?: string
}

export interface EstadoCH {
  id: number
  label: string
  bg: string
  text_color: string
  orden: number
}

export interface LocalidadCH {
  id: string
  orden: number
  localidad: string
  departamento: string | null
  fecha_anuncio: string | null
  expediente: string | null
  monto: number | null
  cantidad_casas: number | null
  ok_gob: string
  doc_exp: string | null
  ejuridico: number | null
  etecnico: number | null
  efinanciero: number | null
  obs: string | null
  updated_at: string
  updated_by: string | null
}

export interface CordobaHogarPanel {
  localidades: LocalidadCH[]
  estados: EstadoCH[]
  presupuesto: number
}

export interface PedidoCH {
  id: string
  localidad_id: string
  descripcion: string
  fecha_pedido: string
  created_at: string
  created_by: string | null
}

export interface PedidoCHCreate {
  descripcion: string
  fecha_pedido: string
}

export interface LocalidadCHUpdate {
  localidad?: string
  departamento?: string
  fecha_anuncio?: string | null
  expediente?: string
  monto?: number | null
  cantidad_casas?: number | null
  ok_gob?: string
  doc_exp?: string
  ejuridico?: number | null
  etecnico?: number | null
  efinanciero?: number | null
  obs?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
