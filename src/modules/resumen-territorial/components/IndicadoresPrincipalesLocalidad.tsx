// Indicadores "principales" de una localidad — pedido explícito del usuario
// (2026-10-01): van primero y más grandes que el resto de los indicadores,
// tanto en el panel principal (ResumenTerritorialPage, cuando hay una
// localidad elegida) como en la Ficha de Localidad (siempre, es inherente a
// esa página). Dos filas:
//   1. Conteos de programas por fuente (Viviendas/CC/CH/Gas/ATP/Demandas) —
//      "Com. Regionales" queda como placeholder explícito: el propio usuario
//      aclaró que todavía no hay fuente de datos (futuro filtro del panel de
//      gestiones de Privada), no se inventa un número.
//   2. Comparativas per cápita (transferencias/ATP/total) de la localidad
//      contra el promedio de su departamento y el promedio provincial.
import type { ResumenLocalidad } from '../types/resumenTerritorial.types'
import type { DepartamentoAgregado, KpisProvincia } from '../utils/departamentoAgregados'

export interface ConteosPrincipalesLocalidad {
  viviendas: string
  cc: number
  ch: number
  gas: number
  atp: number
  demandasGenerales: number
}

/** Cuenta cada categoría a partir de `ResumenLocalidad.programas` — mismos
 * identificadores que usa el backend (`app/resumen_territorial/service.py`):
 * "cordon_cuneta", "cordoba_hogar", "acciones_territorio" (Gas), "atp",
 * "gestiones" (Demandas Generales — Privada). */
export function contarProgramasLocalidad(loc: ResumenLocalidad): ConteosPrincipalesLocalidad {
  const contar = (id: string) => loc.programas.filter((p) => p.programa === id).length
  return {
    viviendas: loc.viviendas_2022 != null ? loc.viviendas_2022.toLocaleString('es-AR') : '—',
    cc: contar('cordon_cuneta'),
    ch: contar('cordoba_hogar'),
    gas: contar('acciones_territorio'),
    atp: contar('atp'),
    demandasGenerales: contar('gestiones'),
  }
}

const fmtMoney = (n: number | null | undefined) => (n == null ? '—' : `$ ${Math.round(n).toLocaleString('es-AR')}`)

export function IndicadoresPrincipalesLocalidad({
  conteos,
  localidad,
  departamentoAgregado,
  kpisProvincia,
}: {
  conteos: ConteosPrincipalesLocalidad
  localidad: ResumenLocalidad
  /** Agregado del departamento de `localidad` calculado sobre TODA la
   * provincia (`calcularDepartamentos(payload)`, sin filtrar) — nunca pasar
   * uno recalculado sobre un subconjunto, el promedio departamental debe ser
   * el real. */
  departamentoAgregado: DepartamentoAgregado | null
  /** `calcularKpisProvincia(payload)` sobre el payload COMPLETO, sin filtrar
   * — mismo criterio que arriba, para que "Provincia" sea siempre el
   * promedio real. */
  kpisProvincia: KpisProvincia
}) {
  const atpMontoLocalidad = localidad.programas
    .filter((p) => p.programa === 'atp')
    .reduce((s, p) => s + (p.monto ?? 0), 0)
  const totalMontoLocalidad = (localidad.transferencias_total ?? 0) + atpMontoLocalidad
  const totalPerCapitaLocalidad =
    localidad.poblacion_2022 && totalMontoLocalidad > 0 ? totalMontoLocalidad / localidad.poblacion_2022 : null

  const tarjetasConteo: { label: string; value: string | number; nd?: boolean; hint?: string }[] = [
    { label: 'Viviendas', value: conteos.viviendas },
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

  const tarjetasPerCapita = [
    {
      label: 'Transferencias per cápita',
      valor: localidad.transferencias_per_capita,
      depto: departamentoAgregado?.transferencias_per_capita ?? null,
      provincia: kpisProvincia.transferencias_per_capita,
    },
    {
      label: 'ATP per cápita',
      valor: localidad.atp_monto_per_capita,
      depto: departamentoAgregado?.atp_monto_per_capita ?? null,
      provincia: kpisProvincia.atp_monto_per_capita,
    },
    {
      label: 'Total per cápita',
      valor: totalPerCapitaLocalidad,
      depto: departamentoAgregado?.total_monto_per_capita ?? null,
      provincia: kpisProvincia.total_monto_per_capita,
    },
  ]

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Indicadores principales — {localidad.localidad}
        </p>
        <div className="flex flex-wrap gap-3">
          {tarjetasConteo.map((c) => (
            <div
              key={c.label}
              title={c.hint}
              className="bg-white rounded-xl px-5 py-4 border-2 border-gov-cyan/40 shadow-sm min-w-[150px]"
            >
              <b
                className={`block text-3xl font-extrabold leading-none mb-1.5 ${
                  c.nd ? 'text-slate-300' : 'text-gov-navy'
                }`}
              >
                {c.value}
              </b>
              <small className="text-[10px] text-gray-500 uppercase tracking-wide">{c.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {tarjetasPerCapita.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl px-5 py-4 border-2 border-gov-cyan/40 shadow-sm min-w-[230px] flex-1"
          >
            <small className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1.5">{c.label}</small>
            <b className="block text-2xl font-extrabold leading-none text-gov-navy mb-2">{fmtMoney(c.valor)}</b>
            <div className="flex gap-4 text-[11px] text-gray-500">
              <span>
                Depto: <b className="text-gov-navy">{fmtMoney(c.depto)}</b>
              </span>
              <span>
                Provincia: <b className="text-gov-navy">{fmtMoney(c.provincia)}</b>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
