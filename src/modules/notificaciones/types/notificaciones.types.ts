// Espejo de app/notificaciones/schemas.py (svc-vivienda).
// Spec: docs/files/spec-notificaciones.md

export type NivelNotificacion = 'info' | 'exito' | 'advertencia' | 'error'
export type DestinoTipo = 'global' | 'rol' | 'secretaria'

export interface Notificacion {
  id: string
  titulo: string
  mensaje: string
  nivel: NivelNotificacion
  origen: string
  enlace: string | null
  destino_tipo: DestinoTipo
  destino_valor: string | null
  created_at: string // ISO
  leida: boolean
}

export interface NotificacionesListResponse {
  items: Notificacion[]
  total: number
  no_leidas: number
}
