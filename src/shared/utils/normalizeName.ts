/** Quita acentos y normaliza mayúsculas — mismo criterio que `app/geo/matching.py`
 * en el backend, para matchear nombres de localidad. */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFKD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '')
    .trim()
    .toLowerCase()
}

/** Normaliza nombres de DEPARTAMENTO para matchear el GeoJSON
 * (`public/geo/departamentos_cba.json`) contra el padrón (`viv_geo_localidades`)
 * — son dos fuentes con grafías distintas: el GeoJSON usa "GRAL. SAN MARTÍN"/
 * "PTE. ROQUE SAENZ PEÑA" (con punto) y "GENERAL ROCA" (sin abreviar), el
 * padrón usa "GRAL SAN MARTÍN"/"PTE ROQUE SAENZ PEÑA" (sin punto) y "GRAL ROCA"
 * (abreviado) — bug real (2026-10-01): esos 3 departamentos aparecían "sin
 * datos" en el mapa pese a tener gestiones reales, porque `normalizeName` a
 * secas no alcanza para igualarlos. Mismo criterio de abreviaturas que
 * `normalize_departamento` en `app/geo/matching.py`, más el punto que el
 * backend no necesita sacar (nunca compara contra el GeoJSON). No usar esto
 * para nombres de LOCALIDAD — ahí "General"/"Presidente" puede ser parte real
 * del nombre propio (ver comentario de `normalize_departamento`). */
export function normalizeDepartamento(s: string | null | undefined): string {
  return normalizeName(s)
    .replace(/\./g, '')
    .replace(/\bgeneral\b/g, 'gral')
    .replace(/\bpresidente\b/g, 'pte')
}
