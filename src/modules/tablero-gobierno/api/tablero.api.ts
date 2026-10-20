// Tablero de Gobierno — reemplazo del Looker "Tablero - Min. de Gobierno"
// (spec-tablero-gobierno-panel.md, ADR-028). Lo sirven svc-datos-externos (transferencias,
// inicio) y svc-gralgob (ATP). Todo el tablero es solo para Admin y Autoridad: el backend
// responde 403 al resto.

import apiClient from '../../../shared/api/client'

const BASE = '/api/v1/datos-externos/tablero'

export interface LocalidadFiltro {
  id_geo: string | null
  codigo_indec: string
  nombre: string
  departamento: string
  tipo: 'Municipio' | 'Comuna' | null
}

export interface FuenteFrescura {
  fuente: string
  etiqueta: string
  estado: 'ok' | 'parcial' | 'fallido' | 'sin_datos'
  ultima_corrida: string | null
  ultimo_periodo: string | null
  detalle: string | null
}

export interface TableroMeta {
  localidades: LocalidadFiltro[]
  anios: number[]
  frescura: FuenteFrescura[]
}

export interface InicioDepartamento {
  departamento: string
  localidades: number
  poblacion: number
  transferido: number
  por_habitante: number | null
}

export interface Inicio {
  anio: number
  periodo_hasta: string | null
  kpis: {
    localidades: number
    municipios: number
    comunas: number
    poblacion: number
    transferido: number
    por_habitante: number | null
  }
  por_departamento: InicioDepartamento[]
}

export interface ConceptoMonto {
  concepto: string
  etiqueta: string
  monto: number
}

/** Una quincena de COPA, un pago de FOFINDES o un mes, sumado sobre el filtro. */
export interface Pago {
  anio: number
  mes: number
  quincena: number | null
  fecha_pago: string | null
  bruto: number
  neto: number
}

export interface RetencionMensual {
  anio: number
  caja: (number | null)[]
  apross: (number | null)[]
  acumulado_caja: (number | null)[]
  acumulado_apross: (number | null)[]
}

export interface PctSueldos {
  bruto: number | null
  neto: number | null
  anio_masa: number | null
  mes_referencia: string
  localidades_con_dato: number
  localidades: number
  incluye_fofindes: boolean
}

export interface Transferencias {
  concepto: string
  etiqueta: string
  anio: number
  ultimo_periodo: string | null
  total_anio: number
  acumulado_anterior: number | null
  variacion: number | null
  ultimo_mes: number | null
  mensual: (number | null)[]
  mensual_anterior: (number | null)[]
  por_concepto: ConceptoMonto[]
  localidades: number
  // Etapa 2: desde la planilla de Gobierno cuando tiene el año
  fuente: 'planilla' | 'transparencia'
  fuente_anterior: 'planilla' | 'transparencia'
  total_neto_anio: number | null
  mensual_neto: (number | null)[] | null
  ultimo_pago: Pago | null
  ultimo_mes_completo: Pago | null
  pagos: Pago[]
  descuentos: ConceptoMonto[]
  retenciones: { mes_referencia: number | null; mensual: RetencionMensual[] } | null
  pct_sueldos: PctSueldos | null
}

export interface FodemeepLocalidad {
  codigo_indec: string
  localidad: string
  departamento: string
  estado: string | null
  meses: (number | null)[]
  total: number
}

export interface Fodemeep {
  anio: number
  kpis: {
    localidades: number
    presupuestado_gestion: number
    transferido_gestion: number
    ultimo_periodo: string | null
    presupuestado_ultimo: number | null
    transferido_ultimo: number | null
    retenido_ultimo: number | null
  }
  mensual_transferido: (number | null)[]
  mensual_retenido: (number | null)[]
  mensual_presupuestado: (number | null)[]
  por_localidad: FodemeepLocalidad[]
  estados: { estado: string; cantidad: number }[]
}

export interface Grupo {
  cantidad: number
  monto: number
}

export interface FommepKpis {
  localidades: number
  monto_total: number
  moviles: Grupo
  edificios_a: Grupo
  edificios_b: Grupo
  edificios_c: Grupo
  edificios: Grupo
  otros: number
}

export interface FommepLocalidad {
  anio: number
  codigo_indec: string
  localidad: string
  departamento: string
  cant_moviles: number
  monto_moviles: number
  cant_edificios: number
  monto_edificios: number
  monto_total: number
}

export interface Fommep {
  anios: number[]
  gestion: FommepKpis | null
  por_anio: { anio: number; kpis: FommepKpis }[]
  por_localidad: FommepLocalidad[]
}

export interface ResumenFila {
  clave: string
  localidad: string | null
  departamento: string
  tipo: string | null
  localidades: number
  poblacion: number
  copa: number
  fofindes: number
  total: number
  por_habitante: number | null
}

export interface Resumen {
  anio: number
  periodo_hasta: string | null
  total: ResumenFila
  por_departamento: ResumenFila[]
  por_localidad: ResumenFila[]
}

export interface AtpGrupo {
  clave: string
  cantidad: number
  monto: number
  pagado: number
}

export interface AtpFila {
  id: string
  fecha_anuncio: string | null
  departamento: string | null
  localidad: string | null
  id_geo: string | null
  ministerio: string | null
  destino: string | null
  nro_expediente: string | null
  derivado: boolean
  monto: number | null
  pagado: number
  estado: 'Pagado' | 'Parcial' | 'Pendiente' | 'Sin dato'
}

export interface AtpCompromisos {
  kpis: { localidades: number; compromisos: number; derivados: number; monto: number; pagado: number; saldo: number }
  por_ministerio: AtpGrupo[]
  por_estado: AtpGrupo[]
  por_departamento: AtpGrupo[]
  filas: AtpFila[]
  ultima_sincronizacion: string | null
  estado_sincronizacion: 'ok' | 'con_errores' | 'en_curso' | 'sin_datos'
}

/** FastAPI espera listas como parámetros repetidos (`codigo_indec=a&codigo_indec=b`), no el
 * `codigo_indec[]=` que arma axios por defecto. */
function params(base: Record<string, string | number>, lista?: { clave: string; valores: string[] | undefined }) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) p.append(k, String(v))
  for (const v of lista?.valores ?? []) p.append(lista!.clave, v)
  return p
}

/** Todas las secciones de transferencias van por la misma ruta del gateway. */
function seccionTransferencias<T>(seccion: string, anio: number, codigos?: string[]): Promise<T> {
  return apiClient
    .get(`${BASE}/transferencias/${seccion}`, { params: params({ anio }, { clave: 'codigo_indec', valores: codigos }) })
    .then((r) => r.data)
}

export const tableroApi = {
  meta: (): Promise<TableroMeta> => apiClient.get(`${BASE}/meta`).then((r) => r.data),
  inicio: (anio: number, codigos?: string[]): Promise<Inicio> =>
    apiClient.get(`${BASE}/inicio`, { params: params({ anio }, { clave: 'codigo_indec', valores: codigos }) }).then((r) => r.data),
  transferencias: (seccion: 'coparticipacion' | 'fofindes', anio: number, codigos?: string[]): Promise<Transferencias> =>
    seccionTransferencias(seccion, anio, codigos),
  fodemeep: (anio: number, codigos?: string[]): Promise<Fodemeep> => seccionTransferencias('fodemeep', anio, codigos),
  fommep: (anio: number, codigos?: string[]): Promise<Fommep> => seccionTransferencias('fommep', anio, codigos),
  resumen: (anio: number, codigos?: string[]): Promise<Resumen> => seccionTransferencias('resumen', anio, codigos),
  atpCompromisos: (idsGeo?: string[]): Promise<AtpCompromisos> =>
    apiClient
      .get('/api/v1/gralgob/tablero/atp-compromisos', { params: params({}, { clave: 'id_geo', valores: idsGeo }) })
      .then((r) => r.data),
}
