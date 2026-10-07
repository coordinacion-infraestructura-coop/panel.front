// Espejo de app/geo/schemas.py (svc-vivienda) — asignación manual de localidades.
// Spec: docs/files/spec-geo-asignacion-manual-localidades.md

export type EstadoPendiente = 'pendiente' | 'resuelta' | 'descartada'
export type AlcanceAlias = 'departamento' | 'global'

export interface AliasResumen {
  id: string
  texto_original: string
  departamento_normalizado: string
  id_geo: string | null
  localidad_oficial: string | null
  departamento_oficial: string | null
  motivo: string | null
  origen: string | null
  created_at: string // ISO
  created_by: string | null
}

export interface GeoPendiente {
  id: string
  origen: string
  departamento: string | null
  localidad: string
  cantidad: number | null
  primera_vez: string // ISO
  ultima_vez: string // ISO
  estado: EstadoPendiente
  resuelta_at: string | null
  resuelta_by: string | null
  alias: AliasResumen | null
}

export interface GeoPendientesResponse {
  items: GeoPendiente[]
  total: number
}

export interface ResolverPendienteIn {
  /** null = "confirmado sin vínculo" */
  id_geo: string | null
  alcance: AlcanceAlias
  motivo: string
  dry_run: boolean
}

export interface RegistroAfectado {
  programa: 'cordon_cuneta' | 'cordoba_hogar' | 'mi_lugar'
  id: string
  nombre_actual: string
  departamento_actual: string | null
  nombre_oficial: string | null
  departamento_oficial: string | null
}

export interface ResolverPendienteOut {
  dry_run: boolean
  id_geo: string | null
  localidad_oficial: string | null
  departamento_oficial: string | null
  registros: RegistroAfectado[]
  duplicados: { programa: 'cordon_cuneta' | 'cordoba_hogar'; cantidad: number }[]
  pendientes_resueltos: number
  propagacion: Record<string, string>
  avisos: string[]
}

export interface DeshacerOut {
  registros_restaurados: number
  registros_omitidos: number
  pendientes_reabiertos: number
  avisos: string[]
}
