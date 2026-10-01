// Indicadores "principales" — pedido explícito del usuario (2026-10-01): van
// primero y más grandes que el resto de los indicadores, SIEMPRE visibles
// (no sólo al elegir una localidad puntual), adaptando su escala al filtro
// activo: toda la provincia sin filtro, el departamento si hay uno elegido
// (sin localidad), o la localidad puntual si la hay — mismo criterio de
// escala que ya usa el resto de `VistaProvincia`. Dos filas:
//   1. Conteos de programas por fuente (CC/CH/Gas/ATP/Demandas), sumados
//      sobre TODAS las localidades de la escala activa. "Com. Regionales"
//      queda como placeholder explícito: el propio usuario aclaró que
//      todavía no hay fuente de datos (futuro filtro del panel de gestiones
//      de Privada), no se inventa un número. "Viviendas" se sacó (mismo
//      día): se pensó como "casas del programa CH", redundante con "CH".
//   2. Comparativas per cápita (transferencias/ATP/total) de la escala
//      activa contra las escalas más amplias que correspondan — a nivel
//      provincia no hay nada más amplio para comparar (se muestra sola), a
//      nivel departamento se compara contra la provincia, a nivel localidad
//      contra depto y provincia.
//
// Rediseño visual (2026-10-01, pedido explícito "mejora estética, usa
// colores, más moderna"): cada fuente tiene un color propio (badge + blob
// decorativo), manteniendo la paleta gov-* para texto/acentos estructurales.
// Sin dependencia de íconos nueva — badges de 2-3 letras en vez de un set de
// SVG, mismo criterio de "no agregar dependencias" que el resto del proyecto
// (ver `lineaReferenciaPlugin` de BarChart.tsx).
import type { ResumenLocalidad } from '../types/resumenTerritorial.types'

export interface ConteosPrincipalesLocalidad {
  cc: number
  ch: number
  gas: number
  atp: number
  demandasGenerales: number
}

/** Suma los conteos sobre un conjunto de localidades — mismos identificadores
 * que usa el backend (`app/resumen_territorial/service.py`): "cordon_cuneta",
 * "cordoba_hogar", "acciones_territorio" (Gas), "atp", "gestiones" (Demandas
 * Generales — Privada). Sirve tanto para una sola localidad (`[loc]`) como
 * para un departamento o la provincia entera (todas sus localidades). */
export function contarProgramasAgregado(localidades: ResumenLocalidad[]): ConteosPrincipalesLocalidad {
  const contar = (id: string) =>
    localidades.reduce((s, loc) => s + loc.programas.filter((p) => p.programa === id).length, 0)
  // "gestiones" es distinto a CC/CH/Gas/ATP: cada fila es un ROLLUP por
  // localidad (`_map_privada_payload` en service.py), no una entidad real —
  // el total de demandas real viaja en `privada_conteos.total`, contar filas
  // sólo da la cantidad de localidades con alguna demanda (bug encontrado
  // 2026-10-01: mostraba 377 localidades en vez de 2247 demandas reales,
  // comparado contra el panel de gestiones de Privada).
  const contarGestiones = () =>
    localidades.reduce(
      (s, loc) =>
        s +
        loc.programas
          .filter((p) => p.programa === 'gestiones')
          .reduce((ss, p) => ss + (p.privada_conteos?.total ?? 0), 0),
      0,
    )
  return {
    cc: contar('cordon_cuneta'),
    ch: contar('cordoba_hogar'),
    gas: contar('acciones_territorio'),
    atp: contar('atp'),
    demandasGenerales: contarGestiones(),
  }
}

export function contarProgramasLocalidad(loc: ResumenLocalidad): ConteosPrincipalesLocalidad {
  return contarProgramasAgregado([loc])
}

export interface ComparativaPerCapita {
  label: string
  valor: number | null
  /** 0, 1 o 2 referencias más amplias contra las que comparar — vacío a
   * nivel provincia (no hay nada más amplio), ["Provincia"] a nivel
   * departamento, ["Depto", "Provincia"] a nivel localidad. */
  secundarios: { label: string; valor: number | null }[]
}

const fmtMoney = (n: number | null | undefined) => (n == null ? '—' : `$ ${Math.round(n).toLocaleString('es-AR')}`)
const fmtMillones = (n: number | null | undefined) =>
  n == null ? '—' : `$ ${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`

// Paleta por fuente — consistente en todo el panel (mapa, gráficos, acá).
// Las 4 fuentes "operativas" (Vivienda CC/CH, Gas, ATP) usan la paleta gov-*
// del servicio; Demandas/Transferencias usan colores semánticos estándar de
// Tailwind (rosa = reclamos, verde = dinero que entra) para que se
// distingan de un vistazo sin inventar una paleta nueva.
const COLOR = {
  cc: '#398ebd', // gov-blue
  ch: '#01aae3', // gov-cyan
  gas: '#d17612', // gov-orange
  atp: '#7c3aed', // violet-600
  comRegionales: '#94a3b8', // slate-400 (placeholder, sin dato)
  demandas: '#e11d48', // rose-600
  transferencias: '#16a34a', // green-600
} as const

function TarjetaIndicador({
  badge,
  color,
  label,
  value,
  nd,
  hint,
}: {
  badge: string
  color: string
  label: string
  value: string | number
  nd?: boolean
  hint?: string
}) {
  return (
    <div
      title={hint}
      className="group relative flex-1 min-w-[140px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full opacity-[0.08] transition-opacity group-hover:opacity-[0.14]"
        style={{ backgroundColor: color }}
      />
      <div className="relative flex items-center gap-2 mb-1.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-extrabold text-white"
          style={{ backgroundColor: nd ? '#cbd5e1' : color }}
        >
          {badge}
        </span>
        <small className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</small>
      </div>
      <b
        className="relative block text-3xl font-extrabold leading-none"
        style={{ color: nd ? '#cbd5e1' : '#172c3f' }}
      >
        {value}
      </b>
    </div>
  )
}

function TarjetaPerCapita({
  color,
  label,
  valor,
  secundarios,
}: {
  color: string
  label: string
  valor: number | null
  secundarios: { label: string; valor: number | null }[]
}) {
  return (
    <div className="relative flex-1 min-w-[200px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <small className="block mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</small>
      <b className="block text-2xl font-extrabold leading-none text-gov-navy mb-2">{fmtMoney(valor)}</b>
      {secundarios.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {secundarios.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-gray-500"
            >
              {s.label}: <b className="font-semibold text-gov-navy">{fmtMoney(s.valor)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Card compuesta ATP anunciado/entregado — barra de progreso en vez de dos
 * tarjetas sueltas, para que se lea de un vistazo que son dos caras del
 * mismo monto (pedido 2026-10-01, mismo criterio que /gralgob/atp). Color de
 * la barra escala de ámbar (poco entregado) a verde (casi todo entregado). */
function TarjetaProgresoAtp({ anunciado, entregado }: { anunciado: number | null; entregado: number | null }) {
  const ratio = anunciado && anunciado > 0 && entregado != null ? Math.min(entregado / anunciado, 1) : null
  const pctLabel = ratio == null ? '—' : fmtPct(ratio * 100)
  const colorBarra = ratio == null ? '#cbd5e1' : ratio >= 0.75 ? '#16a34a' : ratio >= 0.4 ? '#d17612' : '#dc2626'

  return (
    <div className="relative min-w-[260px] flex-[2] overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full opacity-[0.08]"
        style={{ backgroundColor: COLOR.atp }}
      />
      <div className="relative flex items-center gap-2 mb-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-extrabold text-white"
          style={{ backgroundColor: COLOR.atp }}
        >
          ATP
        </span>
        <small className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          Total anunciado vs. entregado a la fecha
        </small>
      </div>
      <div className="relative flex items-end justify-between gap-3 flex-wrap">
        <div>
          <b className="block text-3xl font-extrabold leading-none text-gov-navy">{fmtMillones(anunciado)}</b>
          <small className="text-[10px] text-gray-400">Anunciado</small>
        </div>
        <div className="text-right">
          <b className="block text-xl font-extrabold leading-none" style={{ color: colorBarra }}>
            {pctLabel}
          </b>
          <small className="text-[10px] text-gray-400">Entregado: {fmtMillones(entregado)}</small>
        </div>
      </div>
      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: ratio == null ? '0%' : `${Math.round(ratio * 100)}%`, backgroundColor: colorBarra }}
        />
      </div>
    </div>
  )
}

export function IndicadoresPrincipales({
  titulo,
  conteos,
  comparativas,
  transferenciasTotal,
  atpTotal,
}: {
  /** Ej. "Toda la provincia" / "Departamento Colón" / "Localidad Jesús María". */
  titulo: string
  conteos: ConteosPrincipalesLocalidad
  comparativas: ComparativaPerCapita[]
  /** Monto total de transferencias automáticas de la escala activa, en
   * millones de $ — se muda acá (2026-10-01) desde el panel de "Indicadores"
   * de abajo, junto con el resto de los montos. */
  transferenciasTotal: { valor: number | null; periodo: string | null }
  /** Total ATP "anunciado" (= `monto`) y "entregado a la fecha" (=
   * `monto_entregado`) de la escala activa, como figuran en
   * /gralgob/atp — pedido 2026-10-01 (ADR-025). */
  atpTotal: { anunciado: number | null; entregado: number | null }
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          <span className="inline-block h-2 w-2 rounded-full bg-gov-cyan" />
          Indicadores principales
          <span className="rounded-full bg-gov-navy/5 px-2 py-0.5 text-gov-navy normal-case tracking-normal">
            {titulo}
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          <TarjetaIndicador badge="CC" color={COLOR.cc} label="Cordón Cuneta" value={conteos.cc} />
          <TarjetaIndicador badge="CH" color={COLOR.ch} label="Córdoba Hogar" value={conteos.ch} />
          <TarjetaIndicador badge="GAS" color={COLOR.gas} label="Gas" value={conteos.gas} />
          <TarjetaIndicador badge="ATP" color={COLOR.atp} label="Compromisos Gobernador" value={conteos.atp} />
          <TarjetaIndicador
            badge="CR"
            color={COLOR.comRegionales}
            label="Com. Regionales"
            value="—"
            nd
            hint="Todavía sin fuente de datos — será un filtro del panel de gestiones de Privada"
          />
          <TarjetaIndicador badge="DG" color={COLOR.demandas} label="Demandas Generales" value={conteos.demandasGenerales} />
          <TarjetaIndicador
            badge="$"
            color={COLOR.transferencias}
            label={transferenciasTotal.periodo ? `Transferencias · ${transferenciasTotal.periodo}` : 'Transferencias'}
            value={fmtMillones(transferenciasTotal.valor)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <TarjetaProgresoAtp anunciado={atpTotal.anunciado} entregado={atpTotal.entregado} />
        {comparativas.map((c, i) => (
          <TarjetaPerCapita
            key={c.label}
            color={[COLOR.transferencias, COLOR.atp, '#172c3f'][i] ?? COLOR.cc}
            label={c.label}
            valor={c.valor}
            secundarios={c.secundarios}
          />
        ))}
      </div>
    </div>
  )
}
