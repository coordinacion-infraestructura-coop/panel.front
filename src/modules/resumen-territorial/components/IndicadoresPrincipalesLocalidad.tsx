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
  return {
    cc: contar('cordon_cuneta'),
    ch: contar('cordoba_hogar'),
    gas: contar('acciones_territorio'),
    atp: contar('atp'),
    demandasGenerales: contar('gestiones'),
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

export function IndicadoresPrincipales({
  titulo,
  conteos,
  comparativas,
}: {
  /** Ej. "Toda la provincia" / "Departamento Colón" / "Localidad Jesús María". */
  titulo: string
  conteos: ConteosPrincipalesLocalidad
  comparativas: ComparativaPerCapita[]
}) {
  const tarjetasConteo: { label: string; value: string | number; nd?: boolean; hint?: string }[] = [
    { label: 'CC', value: conteos.cc },
    { label: 'CH', value: conteos.ch },
    { label: 'Gas', value: conteos.gas },
    { label: 'Compromisos Gobernador (ATP)', value: conteos.atp },
    {
      label: 'Com. Regionales',
      value: '—',
      nd: true,
      hint: 'Todavía sin fuente de datos — será un filtro del panel de gestiones de Privada',
    },
    { label: 'Demandas Generales', value: conteos.demandasGenerales },
  ]

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Indicadores principales — {titulo}
        </p>
        <div className="flex flex-wrap gap-3">
          {tarjetasConteo.map((c) => (
            <div
              key={c.label}
              title={c.hint}
              className="bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm min-w-[140px]"
            >
              <b
                className={`block text-3xl font-extrabold leading-none mb-1 ${
                  c.nd ? 'text-slate-300' : 'text-gov-navy'
                }`}
              >
                {c.value}
              </b>
              <small className="text-[10px] text-gray-400 uppercase tracking-wide">{c.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {comparativas.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm min-w-[200px] flex-1"
          >
            <small className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">{c.label}</small>
            <b className="block text-2xl font-extrabold leading-none text-gov-navy mb-2">{fmtMoney(c.valor)}</b>
            {c.secundarios.length > 0 && (
              <div className="flex gap-4 text-[11px] text-gray-500">
                {c.secundarios.map((s) => (
                  <span key={s.label}>
                    {s.label}: <b className="text-gov-navy">{fmtMoney(s.valor)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
