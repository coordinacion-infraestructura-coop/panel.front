// Espejo de app/resumen_territorial/schemas.py (svc-vivienda).
// Spec: docs/files/spec-resumen-territorial.md §5.2

export type AreaResumen = 'vivienda' | 'privada'

export interface ResumenComunicacion {
  fecha: string // YYYY-MM-DD
  texto: string | null
  area: string | null
  autor: string | null
}

export interface ResumenSubestados {
  juridico: string | null
  tecnico: string | null
  financiero: string | null
}

export interface PrivadaConteos {
  por_estado: Record<string, number>
  total: number
}

export interface ResumenPrograma {
  area: AreaResumen
  programa: string // 'cordon_cuneta' | 'cordoba_hogar' | 'mi_lugar' | 'gestiones'
  programa_label: string
  entidad_id: string | null
  detalle: string | null
  estado_general_id: number | null
  estado_general_label: string | null
  estado_general_bg: string | null
  estado_general_text_color: string | null
  subestados: ResumenSubestados | null
  checklist_total: number
  checklist_faltan: number
  checklist_iniciado: boolean
  checklist_faltantes: string[]
  ultima_comunicacion: ResumenComunicacion | null
  monto: number | null
  expediente: string | null
  privada_conteos: PrivadaConteos | null
}

export interface ResumenLocalidad {
  localidad: string
  departamento: string | null
  programas: ResumenPrograma[]
}

export interface ResumenTerritorialPayload {
  generado_para_areas: string[]
  total_localidades: number
  total_programas: number
  localidades: ResumenLocalidad[]
}

export interface ResumenSnapshot {
  payload: ResumenTerritorialPayload
  computed_at: string
  computed_by: string | null
  duracion_ms: number | null
}
