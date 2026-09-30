// Espejo de app/resumen_territorial/schemas.py (svc-vivienda).
// Spec: docs/files/spec-resumen-territorial.md §5.2

export type AreaResumen = 'vivienda' | 'privada' | 'gasifera' | 'gralgob'

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
  id_geo: string | null // ADR-024 — llave de join con svc-datos-externos
  localidad: string
  departamento: string | null
  lat_centro: number | null // centroide del padrón — zoom del mapa a la localidad
  lon_centro: number | null
  // Censo 2022 + transferencias automáticas (svc-datos-externos, ADR-025).
  // Todos null si no hubo match de id_geo o la federación está apagada/caída.
  categoria: 'MU' | 'CO' | null
  poblacion_2022: number | null
  viviendas_2022: number | null
  transferencias_periodo: string | null // ej. "2026-07-01"
  transferencias_total: number | null
  transferencias_por_concepto: Record<string, number> | null
  transferencias_per_capita: number | null
  atp_monto_per_capita: number | null
  programas: ResumenPrograma[]
}

export interface ResumenTerritorialPayload {
  generado_para_areas: string[]
  total_localidades: number
  total_programas: number
  localidades: ResumenLocalidad[]
  // Denominador de "% cobertura" por departamento (padrón viv_geo_localidades,
  // ADR-024) — `localidades` sólo trae las que tienen al menos un programa.
  total_localidades_por_departamento: Record<string, number>
}

export interface ResumenSnapshot {
  payload: ResumenTerritorialPayload
  computed_at: string
  computed_by: string | null
  duracion_ms: number | null
}
