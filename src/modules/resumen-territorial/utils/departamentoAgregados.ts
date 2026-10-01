// Agregación por departamento a partir del payload ya federado (5 fuentes,
// ver ADR-025). Se calcula client-side porque los datos que necesita
// (`poblacion_2022`, el monto de las líneas "atp") ya viajan en
// `ResumenTerritorialPayload.localidades` — no requiere un endpoint nuevo.
//
// El backend (`app/resumen_territorial/aggregations.py::focalizacion_atp_por_departamento`)
// tiene la misma fórmula ya escrita y testeada, pero deliberadamente sin
// exponer todavía (Etapa 2) — no había una vista que la consumiera. Esta es
// esa vista (Etapa 3): misma metodología, calculada acá para no esperar un
// nuevo campo en el payload sólo para esto.
//
// Spec: docs/files/spec-resumen-territorial-tablero-v2.md §4 (Etapa 3)
import type { ResumenTerritorialPayload } from '../types/resumenTerritorial.types'

export interface DepartamentoAgregado {
  departamento: string
  localidades_con_datos: number
  localidades_totales: number // 0 = sin dato del padrón para este depto
  pct_cobertura: number // 0-100, 0 si no hay padrón
  total_programas: number
  promedio_programas: number // total_programas / localidades_totales (0 si no hay padrón)
  poblacion_2022: number | null
  transferencias_total: number | null
  transferencias_per_capita: number | null
  atp_monto: number
  atp_monto_entregado: number // suma de "entregado a la fecha" — ver nota en KpisProvincia
  atp_monto_per_capita: number | null
  total_monto_per_capita: number | null // (transferencias + ATP) / población — "Total per cápita"
  gestiones_10k_hab: number | null
  focalizacion_atp: number | null // null si no hay ATP o población provincial para comparar
}

interface Acumulador {
  localidadesConDatos: number
  totalProgramas: number
  poblacion: number
  transferenciasTotal: number
  atpMonto: number
  atpMontoEntregado: number
}

export function calcularDepartamentos(payload: ResumenTerritorialPayload): DepartamentoAgregado[] {
  const porDepto = new Map<string, Acumulador>()

  const ensure = (dep: string): Acumulador => {
    let acc = porDepto.get(dep)
    if (!acc) {
      acc = { localidadesConDatos: 0, totalProgramas: 0, poblacion: 0, transferenciasTotal: 0, atpMonto: 0, atpMontoEntregado: 0 }
      porDepto.set(dep, acc)
    }
    return acc
  }

  // Departamentos con padrón pero, hoy, cero programas: deben figurar igual
  // (0% de cobertura es un dato real, no "sin datos").
  for (const dep of Object.keys(payload.total_localidades_por_departamento)) ensure(dep)

  for (const loc of payload.localidades) {
    const dep = loc.departamento ?? 'Sin departamento'
    const acc = ensure(dep)
    acc.localidadesConDatos += 1
    acc.totalProgramas += loc.programas.length
    if (loc.poblacion_2022) acc.poblacion += loc.poblacion_2022
    if (loc.transferencias_total) acc.transferenciasTotal += loc.transferencias_total
    for (const p of loc.programas) {
      if (p.programa === 'atp' && p.monto) acc.atpMonto += p.monto
      if (p.programa === 'atp' && p.monto_entregado) acc.atpMontoEntregado += p.monto_entregado
    }
  }

  const totalAtpProvincia = [...porDepto.values()].reduce((s, a) => s + a.atpMonto, 0)
  const totalPoblacionProvincia = [...porDepto.values()].reduce((s, a) => s + a.poblacion, 0)

  const resultado: DepartamentoAgregado[] = []
  for (const [departamento, acc] of porDepto) {
    const localidadesTotales = payload.total_localidades_por_departamento[departamento] ?? 0
    const pctCobertura = localidadesTotales > 0 ? (acc.localidadesConDatos / localidadesTotales) * 100 : 0
    const promedioProgramas = localidadesTotales > 0 ? acc.totalProgramas / localidadesTotales : 0
    const gestiones10kHab = acc.poblacion > 0 ? (acc.totalProgramas / acc.poblacion) * 10000 : null
    const atpPerCapita = acc.poblacion > 0 && acc.atpMonto > 0 ? acc.atpMonto / acc.poblacion : null
    const transferenciasPerCapita =
      acc.poblacion > 0 && acc.transferenciasTotal > 0 ? acc.transferenciasTotal / acc.poblacion : null
    const totalMontoPerCapita =
      acc.poblacion > 0 && acc.transferenciasTotal + acc.atpMonto > 0
        ? (acc.transferenciasTotal + acc.atpMonto) / acc.poblacion
        : null

    let focalizacionAtp: number | null = null
    if (totalAtpProvincia > 0 && totalPoblacionProvincia > 0 && acc.poblacion > 0) {
      const pctAtp = acc.atpMonto / totalAtpProvincia
      const pctPoblacion = acc.poblacion / totalPoblacionProvincia
      focalizacionAtp = pctPoblacion > 0 ? pctAtp / pctPoblacion : null
    }

    resultado.push({
      departamento,
      localidades_con_datos: acc.localidadesConDatos,
      localidades_totales: localidadesTotales,
      pct_cobertura: Math.round(pctCobertura * 10) / 10,
      total_programas: acc.totalProgramas,
      promedio_programas: Math.round(promedioProgramas * 100) / 100,
      poblacion_2022: acc.poblacion || null,
      transferencias_total: acc.transferenciasTotal || null,
      transferencias_per_capita: transferenciasPerCapita,
      atp_monto: acc.atpMonto,
      atp_monto_entregado: acc.atpMontoEntregado,
      atp_monto_per_capita: atpPerCapita,
      total_monto_per_capita: totalMontoPerCapita,
      gestiones_10k_hab: gestiones10kHab !== null ? Math.round(gestiones10kHab * 10) / 10 : null,
      focalizacion_atp: focalizacionAtp !== null ? Math.round(focalizacionAtp * 100) / 100 : null,
    })
  }

  return resultado.sort((a, b) => a.departamento.localeCompare(b.departamento, 'es'))
}

export interface LocalidadFocalizacion {
  localidad: string
  poblacion_2022: number | null
  atp_monto: number
  focalizacion_atp: number | null // null si no hay ATP o población del depto para comparar
}

/** Misma fórmula que `focalizacion_atp` de `calcularDepartamentos`, pero
 * comparando cada localidad contra el total de SU departamento (no contra la
 * provincia) — usado cuando el usuario ya eligió un departamento en el mapa:
 * ahí "Focalización ATP por departamento" deja de tener sentido (ya es uno
 * solo) y pasa a ser "por localidad" dentro de ese departamento. */
export function calcularFocalizacionPorLocalidad(
  payload: ResumenTerritorialPayload,
  departamento: string,
): LocalidadFocalizacion[] {
  const locs = payload.localidades.filter((l) => l.departamento === departamento)

  const porLocalidad = new Map<string, { poblacion: number; atpMonto: number }>()
  for (const loc of locs) {
    const acc = porLocalidad.get(loc.localidad) ?? { poblacion: 0, atpMonto: 0 }
    if (loc.poblacion_2022) acc.poblacion += loc.poblacion_2022
    for (const p of loc.programas) {
      if (p.programa === 'atp' && p.monto) acc.atpMonto += p.monto
    }
    porLocalidad.set(loc.localidad, acc)
  }

  const totalAtpDepto = [...porLocalidad.values()].reduce((s, a) => s + a.atpMonto, 0)
  const totalPoblacionDepto = [...porLocalidad.values()].reduce((s, a) => s + a.poblacion, 0)

  return [...porLocalidad.entries()]
    .map(([localidad, acc]) => {
      let focalizacionAtp: number | null = null
      if (totalAtpDepto > 0 && totalPoblacionDepto > 0 && acc.poblacion > 0) {
        const pctAtp = acc.atpMonto / totalAtpDepto
        const pctPoblacion = acc.poblacion / totalPoblacionDepto
        focalizacionAtp = pctPoblacion > 0 ? pctAtp / pctPoblacion : null
      }
      return {
        localidad,
        poblacion_2022: acc.poblacion || null,
        atp_monto: acc.atpMonto,
        focalizacion_atp: focalizacionAtp !== null ? Math.round(focalizacionAtp * 100) / 100 : null,
      }
    })
    .sort((a, b) => a.localidad.localeCompare(b.localidad, 'es'))
}

export interface KpisProvincia {
  poblacion_2022: number | null
  transferencias_total: number | null
  transferencias_per_capita: number | null
  transferencias_periodo: string | null
  pct_cobertura: number | null // sobre el total de localidades con padrón conocido
  atp_monto_total: number // "anunciado" — ver `atp_monto` en ResumenPrograma
  atp_monto_entregado_total: number // "entregado a la fecha" (ADR-025, 2026-10-01)
  atp_monto_per_capita: number | null
  total_monto_per_capita: number | null // (transferencias + ATP) / población — "Total per cápita"
}

/** KPIs de cabecera a nivel provincia — misma fuente que `calcularDepartamentos`,
 * agregada una vez más. Densidad y crecimiento intercensal quedan fuera a
 * propósito: sin superficie ni Censo 2010 (huecos de datos bloqueados,
 * spec §5), no se fabrican. */
export function calcularKpisProvincia(payload: ResumenTerritorialPayload): KpisProvincia {
  const deptos = calcularDepartamentos(payload)

  const poblacion = deptos.reduce((s, d) => s + (d.poblacion_2022 ?? 0), 0) || null
  const transferenciasTotal = deptos.reduce((s, d) => s + (d.transferencias_total ?? 0), 0) || null
  const atpMontoTotal = deptos.reduce((s, d) => s + d.atp_monto, 0)
  const atpMontoEntregadoTotal = deptos.reduce((s, d) => s + d.atp_monto_entregado, 0)

  const localidadesTotales = deptos.reduce((s, d) => s + d.localidades_totales, 0)
  const localidadesConDatos = deptos.reduce((s, d) => s + d.localidades_con_datos, 0)
  const pctCobertura = localidadesTotales > 0 ? Math.round((localidadesConDatos / localidadesTotales) * 1000) / 10 : null

  const periodo = payload.localidades.find((l) => l.transferencias_periodo)?.transferencias_periodo ?? null

  return {
    poblacion_2022: poblacion,
    transferencias_total: transferenciasTotal,
    transferencias_per_capita:
      transferenciasTotal !== null && poblacion ? Math.round((transferenciasTotal / poblacion) * 100) / 100 : null,
    transferencias_periodo: periodo,
    pct_cobertura: pctCobertura,
    atp_monto_total: atpMontoTotal,
    atp_monto_entregado_total: atpMontoEntregadoTotal,
    atp_monto_per_capita: poblacion && atpMontoTotal > 0 ? Math.round((atpMontoTotal / poblacion) * 100) / 100 : null,
    total_monto_per_capita:
      poblacion && (transferenciasTotal ?? 0) + atpMontoTotal > 0
        ? Math.round((((transferenciasTotal ?? 0) + atpMontoTotal) / poblacion) * 100) / 100
        : null,
  }
}

export interface CoberturaUmbralDepartamento {
  localidades_con_umbral: number
  localidades_totales: number
  pct_cobertura: number // 0-100, 0 si no hay padrón
}

/** Cobertura por departamento con umbral configurable — pedido 2026-10-01,
 * mismo concepto que la "Curva de cobertura por umbral" del informe general
 * de proyecto_sistema_gestiones: en vez de contar como "cubierta" cualquier
 * localidad con ≥1 registro (criterio fijo de `calcularDepartamentos`), acá
 * el mínimo de líneas de programa/gestión que necesita una localidad para
 * contar como cubierta es ajustable (slider del mapa). Cuenta sobre
 * `loc.programas.length` — la suma de TODAS las fuentes (Vivienda CC/CH/ML,
 * Privada, Gasífera, ATP), no sólo gestiones de Privada como en el informe
 * original, porque acá "cobertura" ya es transversal a las 5 fuentes. */
export function calcularCoberturaPorUmbral(
  payload: ResumenTerritorialPayload,
  umbral: number,
): Record<string, CoberturaUmbralDepartamento> {
  const conUmbralPorDepto = new Map<string, number>()
  for (const loc of payload.localidades) {
    if (loc.programas.length < umbral) continue
    const dep = loc.departamento ?? 'Sin departamento'
    conUmbralPorDepto.set(dep, (conUmbralPorDepto.get(dep) ?? 0) + 1)
  }

  const resultado: Record<string, CoberturaUmbralDepartamento> = {}
  for (const [departamento, localidadesTotales] of Object.entries(payload.total_localidades_por_departamento)) {
    const localidadesConUmbral = conUmbralPorDepto.get(departamento) ?? 0
    resultado[departamento] = {
      localidades_con_umbral: localidadesConUmbral,
      localidades_totales: localidadesTotales,
      pct_cobertura: localidadesTotales > 0 ? Math.round((localidadesConUmbral / localidadesTotales) * 1000) / 10 : 0,
    }
  }
  return resultado
}
