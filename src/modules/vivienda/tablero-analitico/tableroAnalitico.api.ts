// Espejo de app/tablero_analitico/schemas.py (svc-vivienda).
// Spec: docs/files/spec-vivienda-tablero-analitico.md §4.
import apiClient from '../../../shared/api/client'
import type { HitoObraPanel } from '../types/vivienda.types'

export type ProgramaTablero = 'cordon_cuneta' | 'cordoba_hogar' | 'mi_lugar'

export interface ExpedienteTablero {
  programa: ProgramaTablero
  programa_label: string
  entidad_id: string
  detalle: string | null
  expediente: string | null
  localidad: string
  departamento: string | null
  id_geo: string | null
  lat: number | null
  lon: number | null
  estado_general_id: number | null
  estado_general_label: string | null
  estado_general_bg: string | null
  estado_general_text_color: string | null
  subestados: { juridico: string | null; tecnico: string | null; financiero: string | null } | null
  checklist_total: number
  checklist_faltan: number
  checklist_iniciado: boolean
  checklist_faltantes: string[]
  ultima_comunicacion: { fecha: string; texto: string | null; area: string | null; autor: string | null } | null
  monto: number | null
  avance_obra_pct: number | null
  avance_obra_fecha: string | null
  fecha_fin_obra: string | null
  hitos_obra: HitoObraPanel[] | null
}

export interface TableroAnalitico {
  generado_en: string
  total_localidades_padron: number
  total_localidades_por_departamento: Record<string, number>
  expedientes: ExpedienteTablero[]
}

/** KPIs de un día — mismas definiciones que `kpisDe` en expedientes.ts (backend: kpis_por_area). */
export interface KpisDia {
  localidades: number
  departamentos: number
  programas_activos: number
  programas_por_programa: Record<string, number>
  items_faltantes: number
  comunicaciones_30d: number
  monto_total: number
  avance_obra_promedio: number | null
}

export interface PuntoTendencia {
  fecha: string
  kpis: KpisDia
}

export const tableroAnaliticoApi = {
  get: () => apiClient.get<TableroAnalitico>('/api/v1/vivienda/tablero-analitico').then((r) => r.data),
  tendencias: (dias: number) =>
    apiClient
      .get<PuntoTendencia[]>('/api/v1/vivienda/tablero-analitico/tendencias', { params: { dias } })
      .then((r) => r.data),
}
