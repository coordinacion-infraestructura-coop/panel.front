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
  /** Etapa 5: toda la gestión; null sin planillas de gestión sincronizadas. */
  gestion: InicioGestion | null
}

export interface InicioGestion {
  visitas: number
  localidades_visitadas: number
  reuniones: number
  localidades_con_reunion: number
  gobernador_visitadas: number
  gobernador_total: number
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
  fondo_ambiental: number
  /** Fase 4: ATP Interno pagado en el año; null si svc-gralgob no respondió. */
  atp: number | null
  atp_sobre_copa_fofin: number | null
  total: number
  por_habitante: number | null
}

export interface Resumen {
  anio: number
  periodo_hasta: string | null
  /** false: el total no incluye ATP porque no se pudo leer. */
  atp_disponible: boolean
  total: ResumenFila
  por_departamento: ResumenFila[]
  por_localidad: ResumenFila[]
}

// ── Etapa 3: fondos (spec-datos-externos-fase3-fondos.md §4). Como FOMMEP, cada respuesta trae
// todos los años y la gestión; la pantalla elige el año.

export interface EstadoMonto {
  estado: string
  cantidad: number
  monto: number
}

export interface PrestamosKpis {
  monto: number
  prestamos: number
  localidades: number
}

export interface FpermPrestamo {
  anio: number | null
  codigo_indec: string | null
  localidad: string | null
  departamento: string | null
  etapas: string | null
  fecha: string | null
  monto_total: number
  cuota: number | null
  plazo: number | null
  mes_inicio_descuento: number | null
  destino: string | null
  ord_res: string | null
}

export interface FpermLocalidad {
  codigo_indec: string
  localidad: string
  departamento: string
  ultima_etapa: number | null
  recibio_ultima: boolean
  recibio_anteultima: boolean
  etapas_disponibles: number[]
  disponible: number
}

export interface FondoPermanente {
  ultima_etapa_habilitada: number | null
  saldo_cuenta: number | null
  localidades_adheridas: number
  recibieron_ultima: number
  recibieron_anteultima: number
  disponible: number
  localidades_con_disponible: number
  listo_para_pagar: PrestamosKpis
  anios: number[]
  gestion: PrestamosKpis
  por_anio: { anio: number; otorgado: PrestamosKpis; mensual: (number | null)[] }[]
  prestamos: FpermPrestamo[]
  localidades: FpermLocalidad[]
}

export interface FondoAmbientalKpis {
  localidades: number
  entes: number
  convenios: number
  afectado: number
  pagado: number
  ingresos: number | null
  disponible: number | null
  estados: EstadoMonto[]
}

export interface FondoAmbientalFila {
  anio: number | null
  codigo: string
  es_ente: boolean
  localidad: string
  departamento: string | null
  expediente: string | null
  convenio: string | null
  fecha_convenio: string | null
  resolucion: string | null
  objeto: string | null
  monto: number
  estado: string | null
  fecha_estado: string | null
}

export interface FondoAmbiental {
  anios: number[]
  gestion: FondoAmbientalKpis | null
  por_anio: { anio: number; kpis: FondoAmbientalKpis }[]
  objetos: { objeto: string; cantidad: number; monto: number }[]
  convenios: FondoAmbientalFila[]
}

export interface CregTipo {
  credito: number | null
  cuotas: number
  monto_cuotas: number
  pagado: number
  a_pagar: number
  saldo: number | null
}

export interface CregKpis {
  funcionamiento: CregTipo
  obras: CregTipo
  total: CregTipo
  comunidades: number
  estados: EstadoMonto[]
}

export interface CregCuota {
  anio: number | null
  codigo_ente: string
  comunidad: string
  departamento: string | null
  tipo: string | null
  expediente: string | null
  destino: string | null
  monto: number | null
  cuota: number | null
  monto_cuota: number | null
  estado: string | null
  fecha_pago: string | null
  fecha_rendicion: string | null
}

export interface ComunidadesRegionales {
  departamentos: string[] | null
  anios: number[]
  gestion: CregKpis | null
  por_anio: { anio: number; kpis: CregKpis }[]
  cuotas: CregCuota[]
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

// ── Etapa 4: ATP Interno (spec-atp-interno.md §4.1). Sin referente. ─────────────────────────

export interface AtpInternoPago {
  fecha: string | null
  anio: number
  codigo_indec: string
  localidad: string | null
  departamento: string | null
  monto: number
}

export interface AtpInternoPeriodo {
  kpis: { localidades: number; pagos: number; monto: number; sin_fecha: number; monto_sin_fecha: number }
  /** 12 valores por mes; vacío para la gestión completa. */
  mensual: number[]
  por_departamento: { departamento: string; localidades: number; pagos: number; monto: number }[]
  por_localidad: { codigo_indec: string; localidad: string | null; departamento: string | null; pagos: number; monto: number; ultimo_pago: string | null }[]
}

export interface AtpInterno {
  anios: number[]
  gestion: AtpInternoPeriodo | null
  por_anio: { anio: number; periodo: AtpInternoPeriodo }[]
  pagos: AtpInternoPago[]
  saldo_disponible: number | null
  ultima_sincronizacion: string | null
  estado_sincronizacion: 'ok' | 'error' | 'frenado' | 'sin_datos'
}

// ── Etapa 5: gestión territorial (spec-datos-externos-fase5-gestion-territorial.md §4) ──────
// Como en las Etapas 3 y 4, cada respuesta trae la gestión y cada año; la pantalla elige.

export interface Conteo {
  clave: string
  cantidad: number
}

export interface Cobertura {
  total: number
  visitadas: number
  municipios: number
  municipios_visitados: number
  comunas: number
  comunas_visitadas: number
}

export interface CoberturaDepartamento extends Cobertura {
  departamento: string
}

export interface VisitaFila {
  fecha: string
  origen: 'funcionarios' | 'ministro'
  funcionario: string | null
  tipo: string | null
  codigo_indec: string
  localidad: string | null
  departamento: string | null
}

export interface VisitasPeriodo {
  visitas: number
  cobertura: Cobertura
  por_departamento: CoberturaDepartamento[]
  por_funcionario: { funcionario: string; actividades: number; localidades: number; municipios: number; comunas: number }[]
  por_tipo: Conteo[]
  mensual: number[]
}

export interface Visitas {
  anios: number[]
  gestion: VisitasPeriodo
  por_anio: { anio: number; periodo: VisitasPeriodo }[]
  visitas: VisitaFila[]
  ultima_fecha: Record<'funcionarios' | 'ministro', string | null>
}

export interface VisitasGobernadorFila {
  codigo_indec: string
  localidad: string
  departamento: string
  tipo: string | null
  visitada: boolean
  fecha_ultima: string | null
  rango_habitantes: string
}

export interface VisitasGobernador {
  cobertura: Cobertura
  por_departamento: CoberturaDepartamento[]
  por_rango: { rango: string; total: number; visitadas: number }[]
  localidades: VisitasGobernadorFila[]
  con_datos: boolean
}

export interface ReunionFila {
  fecha: string
  codigo: string
  localidad: string | null
  departamento: string | null
  temas: string[]
  resolucion: string | null
}

export interface ReunionesPeriodo {
  reuniones: number
  localidades: number
  por_tema: Conteo[]
  por_resolucion: Conteo[]
  mensual: number[]
  por_localidad: { codigo: string; localidad: string | null; departamento: string | null; reuniones: number; pendientes: number; ultima: string }[]
}

export interface Reuniones {
  anios: number[]
  gestion: ReunionesPeriodo
  por_anio: { anio: number; periodo: ReunionesPeriodo }[]
  reuniones: ReunionFila[]
  ultima_fecha: string | null
}

/** Sin monto hasta que el área confirme la moneda. */
export interface ObraFila {
  id_obra: string
  nombre: string | null
  ambito: string | null
  division: string | null
  estado: string | null
  categoria: string | null
  avance: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  departamentos: string[]
  localidades: { codigo: string; nombre: string }[]
}

export interface Obras {
  kpis: { obras: number; en_ejecucion: number; finalizadas: number; a_ejecutar: number; avance_promedio: number | null; localidades: number }
  por_estado: Conteo[]
  por_division: Conteo[]
  por_departamento: { departamento: string; obras: number; en_ejecucion: number; finalizadas: number }[]
  obras: ObraFila[]
}

export interface ConvenioValor {
  valor: 'SI' | 'NO' | 'NC' | null
  cantidad: number | null
  detalle: string | null
}

export interface ConvenioLocalidad {
  codigo_indec: string
  localidad: string
  departamento: string
  tipo: string | null
  valores: Record<string, ConvenioValor>
}

export interface Convenios {
  convenios: string[]
  resumen: { convenio: string; si: number; no: number; nc: number; sin_dato: number; cantidad: number | null }[]
  localidades: ConvenioLocalidad[]
}

export type SeccionGestion = 'obras' | 'visitas' | 'visitas-gobernador' | 'reuniones' | 'convenios'

// ── Etapa 6: Político (spec-datos-externos-fase6-politico.md §4). Solo Admin y Autoridad ──

export interface IntendenteFila {
  codigo_indec: string
  localidad: string
  departamento: string
  tipo: string | null
  intendente: string | null
  reelecto: boolean | null
  partido: string | null
  continuidad: boolean | null
  alineacion: string | null
  celular: string | null
  foto_url: string | null
  /** 'gobierno' | 'privada': de dónde salió el valor (spec-padron-politico-gobierno-privada.md §4) */
  origen_intendente: string | null
  origen_partido: string | null
}

export interface CruceFila {
  localidad: string
  departamento: string
  campo: 'intendente' | 'partido'
  estado: string
  gobierno: string | null
  privada: string | null
}

export interface Intendentes {
  concepto: 'intendentes'
  kpis: { gobiernos_locales: number; con_intendente: number; reelectos: number; continuidad: number; con_celular: number }
  por_partido: Conteo[]
  por_alineacion: Conteo[]
  por_departamento: { departamento: string; total: number; por_alineacion: Record<string, number>; por_partido: Record<string, number> }[]
  intendentes: IntendenteFila[]
  cruce: { disponible: boolean; leido_en: string | null; por_campo: Record<string, Record<string, number>>; diferencias: CruceFila[] } | null
}

interface Podio {
  ganador: string | null
  ganador_pct: number | null
  segundo: string | null
  segundo_pct: number | null
  margen: number | null
}

export interface EleccionDepartamento extends Podio {
  departamento: string
  padron: number | null
  afirmativos: number | null
  participacion: number | null
}

export interface EleccionLocalidad extends Podio {
  codigo_indec: string
  localidad: string
  departamento: string | null
  padron: number | null
  afirmativos: number | null
  participacion: number | null
  pct: Record<string, number | null>
}

export interface EleccionResultado {
  eleccion: string
  titulo: string
  fuente: 'circuitos' | 'copia'
  padron: number | null
  total_votos: number | null
  afirmativos: number | null
  participacion: number | null
  principales: string[]
  fuerzas: { fuerza: string; votos: number | null; pct: number | null }[]
  localidades_ganadas: Conteo[]
  por_departamento: EleccionDepartamento[]
  por_localidad: EleccionLocalidad[]
}

export interface MunicipalFila {
  codigo_indec: string
  localidad: string
  departamento: string | null
  tipo_gobierno: string | null
  fecha: string | null
  periodo: string | null
  participacion: number | null
  padron: number | null
  afirmativos: number | null
  ganador_partido: string | null
  ganador_lista: string | null
  ganador_nombre: string | null
  ganador_pct: number | null
  segundo_partido: string | null
  segundo_nombre: string | null
  segundo_pct: number | null
  margen: number | null
}

export interface VariacionFila {
  codigo_indec: string
  localidad: string
  departamento: string | null
  lla_2023: number
  lla_2025: number
  variacion_lla: number
  hxc_2023: number
  pu_2025: number
  variacion_pu_hxc: number
}

export interface DiferenciaPlanilla {
  localidad: string
  pestana: string
  campo: string
  planilla: string
  calculado: string
}

export interface Elecciones {
  concepto: 'elecciones'
  elecciones: EleccionResultado[]
  municipales: { localidades_ganadas: Conteo[]; sin_votos: number; por_localidad: MunicipalFila[] } | null
  variacion: VariacionFila[]
  diferencias: DiferenciaPlanilla[]
  circuitos_sin_localidad: number
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

function seccionPolitico<T>(seccion: 'intendentes' | 'elecciones', codigos?: string[]): Promise<T> {
  return apiClient.get(`${BASE}/politico/${seccion}`, { params: params({}, { clave: 'codigo_indec', valores: codigos }) }).then((r) => r.data)
}

function seccionGestion<T>(seccion: SeccionGestion, codigos?: string[]): Promise<T> {
  return apiClient.get(`${BASE}/gestion/${seccion}`, { params: params({}, { clave: 'codigo_indec', valores: codigos }) }).then((r) => r.data)
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
  // Etapa 3: el año lo elige cada pantalla; se manda el de la barra solo porque la ruta lo pide.
  fondoPermanente: (anio: number, codigos?: string[]): Promise<FondoPermanente> => seccionTransferencias('fondo-permanente', anio, codigos),
  fondoAmbiental: (anio: number, codigos?: string[]): Promise<FondoAmbiental> => seccionTransferencias('fondo-ambiental', anio, codigos),
  comunidadesRegionales: (anio: number, codigos?: string[]): Promise<ComunidadesRegionales> =>
    seccionTransferencias('comunidades-regionales', anio, codigos),
  atpCompromisos: (idsGeo?: string[]): Promise<AtpCompromisos> =>
    apiClient
      .get('/api/v1/gralgob/tablero/atp-compromisos', { params: params({}, { clave: 'id_geo', valores: idsGeo }) })
      .then((r) => r.data),
  obras: (codigos?: string[]): Promise<Obras> => seccionGestion('obras', codigos),
  visitas: (codigos?: string[]): Promise<Visitas> => seccionGestion('visitas', codigos),
  visitasGobernador: (codigos?: string[]): Promise<VisitasGobernador> => seccionGestion('visitas-gobernador', codigos),
  reuniones: (codigos?: string[]): Promise<Reuniones> => seccionGestion('reuniones', codigos),
  convenios: (codigos?: string[]): Promise<Convenios> => seccionGestion('convenios', codigos),
  intendentes: (codigos?: string[]): Promise<Intendentes> => seccionPolitico('intendentes', codigos),
  elecciones: (codigos?: string[]): Promise<Elecciones> => seccionPolitico('elecciones', codigos),
  atpInterno: (codigos?: string[]): Promise<AtpInterno> =>
    apiClient
      .get('/api/v1/gralgob/tablero/atp-interno', { params: params({}, { clave: 'codigo_indec', valores: codigos }) })
      .then((r) => r.data),
}
