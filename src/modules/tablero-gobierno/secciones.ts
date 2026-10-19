// Secciones del tablero (spec-tablero-gobierno-panel.md §2.2) y en qué etapa llega cada
// pantalla (§5). Mientras una pantalla no tiene su etapa hecha, se muestra "en preparación"
// con lo que va a traer, para que el recorrido sea el definitivo desde la Etapa 0.

export interface SubSeccion {
  id: string
  nombre: string
  etapa: string
  contenido: string[]
  restringida?: boolean
}

export interface Seccion {
  id: string
  nombre: string
  restringida?: boolean
  subs: SubSeccion[]
}

export const SECCIONES: Seccion[] = [
  {
    id: 'inicio',
    nombre: 'Inicio',
    subs: [
      {
        id: 'inicio',
        nombre: 'Inicio',
        etapa: 'E1',
        contenido: [
          'KPIs: localidades, población 2022, transferido en el año y por habitante, localidades visitadas, compromisos del Gobernador',
          'Mapa por departamento o por localidad (transferido por habitante, ATP, visitas)',
          '"Para mirar": cruces entre fuentes',
          'Convenios firmados',
        ],
      },
    ],
  },
  {
    id: 'transferencias',
    nombre: 'Transferencias',
    subs: [
      { id: 'resumen', nombre: 'Resumen general', etapa: 'E2', contenido: ['Tablas por departamento y por localidad', 'Semáforo ATP/COPA+FOFIN con mapa', 'Total y total por habitante'] },
      { id: 'coparticipacion', nombre: 'Coparticipación', etapa: 'E1 → E2', contenido: ['Pagos por quincena y mes', '% a sueldos (velocímetros)', 'Retenciones Caja y APROSS sobre la COPA bruta'] },
      { id: 'fofindes', nombre: 'FOFINDES', etapa: 'E1 → E2', contenido: ['KPIs del año y del último mes', 'Serie mensual bruto y neto'] },
      { id: 'fodemeep', nombre: 'FODEMEEP', etapa: 'E2', contenido: ['Neto a transferir por mes (transferido y pendiente)', 'Estado de adhesión', 'Neto a transferir por localidad y mes'] },
      { id: 'fommep', nombre: 'FOMMEP', etapa: 'E2', contenido: ['Móviles y edificios por categoría', 'Filtro por año'] },
    ],
  },
  {
    id: 'fondos',
    nombre: 'Fondos y aportes',
    subs: [
      { id: 'atp-compromisos', nombre: 'ATP Compromisos', etapa: 'E1', contenido: ['Compromisos del Gobernador por ministerio y estado de pago', 'Tabla de compromisos'] },
      { id: 'atp-interno', nombre: 'ATP Interno', etapa: 'E4', restringida: true, contenido: ['Pagos por mes', 'ATP por habitante en el mapa', 'Detalle por localidad'] },
      { id: 'focom', nombre: 'FOCOM', etapa: 'E3', contenido: ['Embudo de estados', 'Cómo se pagó (Pagado · Pagado ATP · Pendiente ATP)', 'Mapa y tabla'] },
      { id: 'fondo-federal', nombre: 'Fondo Federal', etapa: 'E3', contenido: ['Cuotas, saldo, aportes y repago', 'Localidades que recibieron la última y la anteúltima cuota', 'Etapas por localidad'] },
      { id: 'fondo-ambiental', nombre: 'Fondo Ambiental', etapa: 'E3', contenido: ['Estados con torta y mapa', 'Tabla de destinos'] },
      { id: 'comunidades-regionales', nombre: 'Comunidades Regionales', etapa: 'E3', contenido: ['Cuotas por estado', 'Fondos para obras'] },
    ],
  },
  {
    id: 'gestion',
    nombre: 'Gestión territorial',
    subs: [
      { id: 'obras', nombre: 'Obras', etapa: 'E5', contenido: ['Por departamento (con prorrateo) y por localidad', 'Obras generales', 'Estado y tipo'] },
      { id: 'visitas', nombre: 'Visitas', etapa: 'E5', contenido: ['Cobertura total, municipios y comunas', 'Mapa', 'Visitas registradas y por funcionario'] },
      { id: 'visitas-gobernador', nombre: 'Visitas del Gobernador', etapa: 'E5', contenido: ['Cobertura y mapa', 'Visitadas y aún no visitadas'] },
      { id: 'reuniones', nombre: 'Reuniones', etapa: 'E5', contenido: ['Reuniones por mes y localidad'] },
      { id: 'convenios', nombre: 'Convenios', etapa: 'E5', contenido: ['Matriz SI / NO por localidad'] },
      { id: 'ipcam', nombre: 'Capacitación IPCAM', etapa: 'E5', contenido: ['Personas capacitadas por año e iniciativa', 'Top 10 por certificados (sin DNI)'] },
    ],
  },
  {
    id: 'expedientes',
    nombre: 'Expedientes',
    subs: [
      { id: 'expedientes', nombre: 'Expedientes', etapa: 'E1', contenido: ['Expedientes visados de Cordón Cuneta y Gas, con datos del sistema', 'Por programa y estado'] },
    ],
  },
  {
    id: 'politico',
    nombre: 'Político',
    restringida: true,
    subs: [
      { id: 'intendentes', nombre: 'Intendentes', etapa: 'E6', contenido: ['Intendente, partido, reelecto, continuidad, contacto'] },
      { id: 'legisladores', nombre: 'Legisladores', etapa: 'E6', contenido: ['Legislador departamental y partido'] },
      { id: 'elecciones', nombre: 'Elecciones', etapa: 'E6', contenido: ['Resultados 2023 y 2025 por fuerza', 'Resultado municipal por localidad'] },
    ],
  },
]
