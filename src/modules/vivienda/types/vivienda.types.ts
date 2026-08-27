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

// ── Cordón Cuneta ───────────────────────────────────────────────────────────────

export interface EstadoCC {
  id: number
  label: string
  bg: string
  text_color: string
  orden: number
  aplica_juridico: boolean
  aplica_tecnico: boolean
  aplica_financiero: boolean
}

export interface EstadoCCCreate {
  label: string
  bg: string
  text_color: string
  orden: number
  aplica_juridico?: boolean
  aplica_tecnico?: boolean
  aplica_financiero?: boolean
}

export interface EstadoCCUpdate {
  label?: string
  bg?: string
  text_color?: string
  orden?: number
  aplica_juridico?: boolean
  aplica_tecnico?: boolean
  aplica_financiero?: boolean
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
  estado_general: number | null
  cordon_cuneta_ml: number | null
  adoquinado_m2: number | null
  obs: string | null
  updated_at: string
  updated_by: string | null
}

export interface MunicipioCCCreate {
  municipio: string
  departamento?: string
  expediente?: string
  monto?: number
  ok_gob?: string
  ejuridico?: number
  etecnico?: number
  efinanciero?: number
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
  created_by_nombre: string | null
  secretaria: string | null
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
  estado_general?: number | null
  cordon_cuneta_ml?: number | null
  adoquinado_m2?: number | null
  obs?: string
  fecha_cambio?: string | null
}

export interface EstadoHistorialCC {
  id: string
  municipio_id: string
  campo: string
  estado_anterior_id: number | null
  estado_nuevo_id: number
  created_at: string
  created_by: string | null
}

// ── Checklist Técnico (sync Google Sheet "Base TOTAL") ──────────────────────────

export interface ChecklistItemCC {
  item_num: number
  item_label: string
  valor: string
}

export interface ChecklistSyncEstadoCC {
  started_at: string
  finished_at: string | null
  filas_leidas: number
  filas_insertadas: number
  filas_actualizadas: number
  filas_error: number
  triggered_by: string | null
}

export interface ChecklistSyncResultadoCC {
  filas_leidas: number
  filas_insertadas: number
  filas_actualizadas: number
  filas_error: number
  errores: Array<{ fila: number; motivo: string }>
}

export interface ChecklistTecnicoCC {
  id: string
  localidad: string
  departamento: string | null
  expediente: string | null
  tipo: string | null
  intendente: string | null
  telefono: string | null
  email: string | null
  contacto_tecnico: string | null
  monto_convenio: number | null
  cordon_cuneta_ml: number | null
  adoquinado_m2: number | null
  estado_expediente: string | null
  observaciones: string | null
  fecha_radicacion: string | null
  reparticion: string | null
  last_synced_at: string
  items: ChecklistItemCC[]
}

// ── Córdoba Hogar ────────────────────────────────────────────────────────────────

export interface EstadoCH {
  id: number
  label: string
  bg: string
  text_color: string
  orden: number
  aplica_juridico: boolean
  aplica_tecnico: boolean
  aplica_financiero: boolean
}

export interface EstadoCHCreate {
  label: string
  bg: string
  text_color: string
  orden: number
  aplica_juridico?: boolean
  aplica_tecnico?: boolean
  aplica_financiero?: boolean
}

export interface EstadoCHUpdate {
  label?: string
  bg?: string
  text_color?: string
  orden?: number
  aplica_juridico?: boolean
  aplica_tecnico?: boolean
  aplica_financiero?: boolean
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
  estado_general: number | null
  obs: string | null
  updated_at: string
  updated_by: string | null
}

export interface LocalidadCHCreate {
  localidad: string
  departamento?: string
  fecha_anuncio?: string
  expediente?: string
  monto?: number
  cantidad_casas?: number
  ok_gob?: string
  ejuridico?: number
  etecnico?: number
  efinanciero?: number
}

export interface CordobaHogarPanel {
  localidades: LocalidadCH[]
  estados: EstadoCH[]
  presupuesto: number
  monto_por_casa: number
}

export interface PedidoCH {
  id: string
  localidad_id: string
  descripcion: string
  fecha_pedido: string
  created_at: string
  created_by: string | null
  created_by_nombre: string | null
  secretaria: string | null
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
  estado_general?: number | null
  obs?: string
  fecha_cambio?: string | null
}

export interface EstadoHistorialCH {
  id: string
  localidad_id: string
  campo: string
  estado_anterior_id: number | null
  estado_nuevo_id: number
  created_at: string
  created_by: string | null
}

// ── Mi Lugar ─────────────────────────────────────────────────────────────────────

export type TipoProyectoML = 'exp' | 'muni' | 'prov'

export interface EstadoML {
  id: number
  label: string
  bg: string
  text_color: string
  orden: number
  tipo: string
  aplica_juridico: boolean
  aplica_tecnico: boolean
  aplica_financiero: boolean
}

export interface EstadoMLCreate {
  label: string
  bg: string
  text_color: string
  orden: number
  tipo?: string
  aplica_juridico?: boolean
  aplica_tecnico?: boolean
  aplica_financiero?: boolean
}

export interface EstadoMLUpdate {
  label?: string
  bg?: string
  text_color?: string
  orden?: number
  aplica_juridico?: boolean
  aplica_tecnico?: boolean
  aplica_financiero?: boolean
}

export interface GeoPuntoML {
  id: string
  lat: number
  lng: number
  orden: number
}

export interface GeoPuntoMLCreate {
  lat: number
  lng: number
}

export interface ProyectoML {
  id: string
  tipo: TipoProyectoML
  nombre: string
  localidad_id: string | null
  localidad_nombre: string
  departamento: string | null
  expediente: string | null
  responsable: string | null
  superficie: number | null
  lotes: number | null
  monto: number | null
  valor_fiscal: number | null
  infra_sin_nexos: number | null
  costo_nexos: number | null
  convenio_unc: number | null
  costo_total_infra: number | null
  ok_gob: string
  ejuridico: number | null
  etecnico: number | null
  efinanciero: number | null
  estado_general: number | null
  obs: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
  geo_puntos: GeoPuntoML[]
}

export interface ProyectoMLCreate {
  tipo: TipoProyectoML
  nombre: string
  localidad_id?: string | null
  localidad_nombre: string
  departamento?: string | null
  expediente?: string | null
  responsable?: string | null
  superficie?: number | null
  lotes?: number | null
  monto?: number | null
  valor_fiscal?: number | null
  infra_sin_nexos?: number | null
  costo_nexos?: number | null
  convenio_unc?: number | null
  costo_total_infra?: number | null
  ok_gob?: string
  ejuridico?: number | null
  etecnico?: number | null
  efinanciero?: number | null
  estado_general?: number | null
  obs?: string | null
  geo_puntos?: GeoPuntoMLCreate[]
}

export interface ProyectoMLUpdate {
  nombre?: string | null
  localidad_id?: string | null
  localidad_nombre?: string | null
  departamento?: string | null
  expediente?: string | null
  responsable?: string | null
  superficie?: number | null
  lotes?: number | null
  monto?: number | null
  valor_fiscal?: number | null
  infra_sin_nexos?: number | null
  costo_nexos?: number | null
  convenio_unc?: number | null
  costo_total_infra?: number | null
  ok_gob?: string | null
  ejuridico?: number | null
  etecnico?: number | null
  efinanciero?: number | null
  estado_general?: number | null
  obs?: string | null
  geo_puntos?: GeoPuntoMLCreate[] | null
  fecha_cambio?: string | null
}

export interface EstadoHistorialML {
  id: string
  proyecto_id: string
  campo: string
  estado_anterior_id: number | null
  estado_nuevo_id: number
  created_at: string
  created_by: string | null
}

export interface PedidoML {
  id: string
  proyecto_id: string
  descripcion: string
  fecha_pedido: string
  created_at: string
  created_by: string | null
  created_by_nombre: string | null
  secretaria: string | null
}

export interface PedidoMLCreate {
  descripcion: string
  fecha_pedido: string
}

export interface ConfigML {
  id: number
  tipo_cambio: number
  usd_por_lote: number
  lotes_por_ha: number
  monto_por_lote_muni: number
}

export interface ConfigMLUpdate {
  tipo_cambio?: number | null
  usd_por_lote?: number | null
  lotes_por_ha?: number | null
}

// ── Geo ─────────────────────────────────────────────────────────────────────────

export interface GeoLocalidad {
  id_geo: string
  departamento: string
  localidad: string
  lat_centro: number | null
  lon_centro: number | null
  activo: boolean
}

// ── Shared ───────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// ── Informe por programa (Cordón Cuneta / Córdoba Hogar) ──────────────────────────

export type ProgramaInforme = 'cordon_cuneta' | 'cordoba_hogar'

export interface EstadoConteo {
  estado_id: number | null
  label: string
  bg: string
  text_color: string
  cantidad: number
}

export interface DepartamentoCobertura {
  departamento: string
  cantidad: number
  localidades_cubiertas: number
  localidades_totales: number
  pct_cobertura: number
}

export interface EvolucionMes {
  mes: string
  cantidad_cambios: number
}

export interface PuntoInforme {
  id: string
  nombre: string
  departamento: string | null
  lat: number | null
  lon: number | null
  estado_general_id: number | null
  estado_label: string | null
  estado_bg: string | null
  estado_text_color: string | null
  expediente: string | null
  monto: number | null
}

export interface InformePayload {
  programa: ProgramaInforme
  total_entidades: number
  monto_total: number
  metricas_extra: Record<string, number>
  departamentos_cubiertos: number
  por_estado_general: EstadoConteo[]
  por_departamento: DepartamentoCobertura[]
  evolucion_temporal: EvolucionMes[]
  puntos: PuntoInforme[]
}

export interface InformeSnapshot {
  payload: InformePayload
  computed_at: string
  computed_by: string | null
  duracion_ms: number | null
}

// ── Checklist Técnico DGV ────────────────────────────────────────────────────

export type ProgramaChecklist = 'cc' | 'ch' | 'ml'
export type ValorItemChecklist = 'sin_presentar' | 'eval_tecnica' | 'a_corregir' | 'eval_juridica' | 'completo'
export type TipoHitoChecklist = 'anticipo' | '40' | '70' | '100'

export interface CatalogoEstadoExpediente {
  id: number
  label: string
  orden: number
  activo: boolean
}

export interface CatalogoEstadoExpedienteCreate {
  label: string
  orden: number
  activo?: boolean
}

export interface CatalogoEstadoExpedienteUpdate {
  label?: string
  orden?: number
  activo?: boolean
}

export interface CatalogoReparticion {
  id: number
  programa: ProgramaChecklist | null
  label: string
  orden: number
  activo: boolean
}

export interface CatalogoReparticionCreate {
  programa?: ProgramaChecklist | null
  label: string
  orden: number
  activo?: boolean
}

export interface CatalogoReparticionUpdate {
  programa?: ProgramaChecklist | null
  label?: string
  orden?: number
  activo?: boolean
}

export interface ItemSubDefinicion {
  sub_item_num: number
  label: string
}

export interface ItemDefinicion {
  item_num: number
  label: string
  sub_items: ItemSubDefinicion[] | null
}

export interface CatalogosChecklist {
  estados_expediente: CatalogoEstadoExpediente[]
  reparticiones: CatalogoReparticion[]
  items_por_programa: Record<ProgramaChecklist, ItemDefinicion[]>
}

export interface EntidadResumenChecklist {
  nombre: string
  departamento: string | null
  expediente: string | null
  monto: number | null
  dato_extra_label: string | null
  dato_extra_valor: string | null
}

export interface ChecklistItemDetalle {
  item_num: number
  sub_item_num: number | null
  label: string
  valor: ValorItemChecklist
}

export interface ChecklistItemUpdate {
  valor: ValorItemChecklist
  sub_item_num?: number | null
}

export interface HitoChecklist {
  tipo: TipoHitoChecklist
  label: string
  monto: number | null
  fecha_acreditado: string | null
}

export interface HitoChecklistUpdate {
  fecha_acreditado: string | null
}

export interface ChecklistTecnico {
  programa: ProgramaChecklist
  entidad_id: string
  entidad: EntidadResumenChecklist
  estado_expediente_id: number | null
  estado_expediente_label: string | null
  fecha_radicacion: string | null
  reparticion_id: number | null
  reparticion_label: string | null
  items: ChecklistItemDetalle[]
  hitos: HitoChecklist[] | null
  updated_at: string
  updated_by: string | null
}

export interface ChecklistTecnicoUpdate {
  estado_expediente_id?: number | null
  fecha_radicacion?: string | null
  reparticion_id?: number | null
}
