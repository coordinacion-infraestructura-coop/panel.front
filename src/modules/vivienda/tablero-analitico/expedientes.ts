// Lógica pura del Tablero analítico: filtros, KPIs, agrupación y rankings.
// Spec: docs/files/spec-vivienda-tablero-analitico.md §5–§6.
import { haversineKm, type Coord } from '../../../shared/utils/geo'
import { situacionObra, type SituacionObra } from '../avanceObra'
import type { ExpedienteTablero, KpisDia, ProgramaTablero } from './tableroAnalitico.api'

export const PROGRAMAS: { id: ProgramaTablero; label: string; color: string }[] = [
  { id: 'cordon_cuneta', label: 'Cordón Cuneta y Adoquinado', color: '#d17612' },
  { id: 'cordoba_hogar', label: 'Córdoba Hogar', color: '#398ebd' },
  { id: 'mi_lugar', label: 'Mi Lugar', color: '#16a34a' },
]
export const COLOR_PROGRAMA: Record<ProgramaTablero, string> = Object.fromEntries(
  PROGRAMAS.map((p) => [p.id, p.color]),
) as Record<ProgramaTablero, string>

export type Documentacion = 'completa' | 'incompleta' | 'no_iniciada'
export const DOCUMENTACION_LABEL: Record<Documentacion, string> = {
  completa: 'Completa', incompleta: 'Incompleta', no_iniciada: 'No iniciada',
}

export function documentacionDe(e: ExpedienteTablero): Documentacion {
  if (!e.checklist_iniciado) return 'no_iniciada'
  return e.checklist_faltan > 0 ? 'incompleta' : 'completa'
}

export function textoChecklist(e: ExpedienteTablero): string {
  if (!e.checklist_iniciado) return 'No iniciado'
  if (e.checklist_faltan === 0) return 'Completo'
  return `${e.checklist_faltan} de ${e.checklist_total} faltan`
}

export interface Filtros {
  texto: string
  departamento: string
  localidad: string // clave de localidad (ver `claveLocalidad`)
  programa: ProgramaTablero | ''
  estadoGeneral: string
  juridico: string
  tecnico: string
  financiero: string
  documentacion: Documentacion | ''
  obra: SituacionObra | ''
  km: string
}

export const FILTROS_VACIOS: Filtros = {
  texto: '', departamento: '', localidad: '', programa: '', estadoGeneral: '', juridico: '',
  tecnico: '', financiero: '', documentacion: '', obra: '', km: '',
}

export function hayFiltros(f: Filtros, origen: Coord | null): boolean {
  return Object.entries(f).some(([k, v]) => k !== 'km' && v !== '') || (!!origen && Number(f.km) > 0)
}

/** Clave estable de localidad: `id_geo` del padrón, o texto si no está vinculada. */
export function claveLocalidad(e: Pick<ExpedienteTablero, 'id_geo' | 'departamento' | 'localidad'>): string {
  return e.id_geo ?? `txt:${e.departamento ?? ''}|${e.localidad}`
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const compararEs = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })

export interface FilaExpediente extends ExpedienteTablero {
  distanciaKm: number | null
}

export function aplicarFiltros(exps: ExpedienteTablero[], f: Filtros, origen: Coord | null): FilaExpediente[] {
  const texto = norm(f.texto.trim())
  const km = Number(f.km)
  const conDistancia = !!origen && km > 0
  const out: FilaExpediente[] = []
  for (const e of exps) {
    if (texto && !norm(`${e.localidad} ${e.departamento ?? ''} ${e.detalle ?? ''}`).includes(texto)) continue
    if (f.departamento && e.departamento !== f.departamento) continue
    if (f.localidad && claveLocalidad(e) !== f.localidad) continue
    if (f.programa && e.programa !== f.programa) continue
    if (f.estadoGeneral && e.estado_general_label !== f.estadoGeneral) continue
    if (f.juridico && e.subestados?.juridico !== f.juridico) continue
    if (f.tecnico && e.subestados?.tecnico !== f.tecnico) continue
    if (f.financiero && e.subestados?.financiero !== f.financiero) continue
    if (f.documentacion && documentacionDe(e) !== f.documentacion) continue
    if (f.obra && situacionObra(e) !== f.obra) continue
    const distanciaKm = origen && e.lat !== null && e.lon !== null ? haversineKm(origen, { lat: e.lat, lon: e.lon }) : null
    if (conDistancia && (distanciaKm === null || distanciaKm > km)) continue
    out.push({ ...e, distanciaKm })
  }
  return out
}

/** Ruta al Checklist Técnico de un expediente (spec v1.1.0 §5.4). */
const CHECKLIST_PROGRAMA: Record<ProgramaTablero, string> = { cordon_cuneta: 'cc', cordoba_hogar: 'ch', mi_lugar: 'ml' }
export function urlChecklist(e: Pick<ExpedienteTablero, 'programa' | 'entidad_id'>): string {
  return `/vivienda/checklist-tecnico?programa=${CHECKLIST_PROGRAMA[e.programa]}&entidad=${encodeURIComponent(e.entidad_id)}`
}

/** Valores presentes en los datos, en orden alfabético — opciones de los desplegables (§9). */
export function opciones(exps: ExpedienteTablero[], valor: (e: ExpedienteTablero) => string | null | undefined): string[] {
  return [...new Set(exps.map(valor).filter((v): v is string => !!v))].sort(compararEs)
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

const VENTANA_COMUNICACIONES_DIAS = 30

function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function restarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - dias))
  return dt.toISOString().slice(0, 10)
}

export function comunicacionReciente(e: ExpedienteTablero, hoy = hoyIso()): boolean {
  const f = e.ultima_comunicacion?.fecha?.slice(0, 10)
  return !!f && f >= restarDias(hoy, VENTANA_COMUNICACIONES_DIAS) && f <= hoy
}

/** Mismas definiciones que `aggregations.kpis_por_area` del backend, para que el delta compare igual. */
export function kpisDe(rows: ExpedienteTablero[]): KpisDia {
  const locs = new Set<string>()
  const locsFaltantes = new Set<string>()
  const deptos = new Set<string>()
  const porPrograma: Record<string, number> = {}
  let faltantes = 0
  let comunicaciones = 0
  let monto = 0
  const avances: number[] = []
  const hoy = hoyIso()
  for (const e of rows) {
    locs.add(claveLocalidad(e))
    if (e.departamento) deptos.add(e.departamento)
    porPrograma[e.programa] = (porPrograma[e.programa] ?? 0) + 1
    if (e.checklist_faltan > 0) {
      faltantes++
      locsFaltantes.add(claveLocalidad(e))
    }
    if (comunicacionReciente(e, hoy)) comunicaciones++
    if (e.monto !== null) monto += e.monto
    if (e.avance_obra_pct !== null) avances.push(e.avance_obra_pct)
  }
  return {
    localidades: locs.size,
    departamentos: deptos.size,
    programas_activos: rows.length,
    programas_por_programa: porPrograma,
    items_faltantes: faltantes,
    localidades_items_faltantes: locsFaltantes.size,
    comunicaciones_30d: comunicaciones,
    monto_total: monto,
    avance_obra_promedio: avances.length ? Math.round((avances.reduce((a, b) => a + b, 0) / avances.length) * 10) / 10 : null,
  }
}

/** Por programa: localidades y departamentos distintos con al menos un expediente del programa. */
export function coberturaPorPrograma(rows: ExpedienteTablero[]) {
  return PROGRAMAS.map((p) => {
    const delPrograma = rows.filter((e) => e.programa === p.id)
    return {
      ...p,
      expedientes: delPrograma.length,
      localidades: new Set(delPrograma.map(claveLocalidad)).size,
      departamentos: new Set(delPrograma.map((e) => e.departamento).filter(Boolean)).size,
      conFaltantes: delPrograma.filter((e) => e.checklist_faltan > 0).length,
      /** Localidades del programa con al menos un expediente con ítems faltantes (spec v1.1.0 §5.2). */
      localidadesConFaltantes: new Set(delPrograma.filter((e) => e.checklist_faltan > 0).map(claveLocalidad)).size,
    }
  })
}

// ── Agrupación y rankings ────────────────────────────────────────────────────

export interface GrupoLocalidad {
  clave: string
  localidad: string
  departamento: string | null
  lat: number | null
  lon: number | null
  distanciaKm: number | null
  expedientes: FilaExpediente[]
}

export function agruparPorLocalidad(rows: FilaExpediente[], porDistancia: boolean): GrupoLocalidad[] {
  const grupos = new Map<string, GrupoLocalidad>()
  for (const e of rows) {
    const k = claveLocalidad(e)
    let g = grupos.get(k)
    if (!g) {
      g = { clave: k, localidad: e.localidad, departamento: e.departamento, lat: e.lat, lon: e.lon, distanciaKm: e.distanciaKm, expedientes: [] }
      grupos.set(k, g)
    }
    g.expedientes.push(e)
  }
  const lista = [...grupos.values()]
  for (const g of lista) {
    g.expedientes.sort((a, b) => compararEs(a.programa_label, b.programa_label) || compararEs(a.detalle ?? '', b.detalle ?? ''))
  }
  return lista.sort((a, b) =>
    porDistancia && a.distanciaKm !== null && b.distanciaKm !== null
      ? a.distanciaKm - b.distanciaKm
      : compararEs(a.localidad, b.localidad) || compararEs(a.departamento ?? '', b.departamento ?? ''),
  )
}

export function porDepartamento(rows: ExpedienteTablero[]) {
  const m = new Map<string, { departamento: string; cantidad: number; comunicaciones: number }>()
  const hoy = hoyIso()
  for (const e of rows) {
    if (!e.departamento) continue
    const d = m.get(e.departamento) ?? { departamento: e.departamento, cantidad: 0, comunicaciones: 0 }
    d.cantidad++
    if (comunicacionReciente(e, hoy)) d.comunicaciones++
    m.set(e.departamento, d)
  }
  return [...m.values()]
}

/** Punto de la serie más cercano a "hace `dias` días" (el último en o antes de esa fecha). */
export function puntoHace<T extends { fecha: string }>(serie: T[], dias: number): T | null {
  const limite = restarDias(hoyIso(), dias)
  let elegido: T | null = null
  for (const p of serie) if (p.fecha <= limite) elegido = p
  return elegido
}
