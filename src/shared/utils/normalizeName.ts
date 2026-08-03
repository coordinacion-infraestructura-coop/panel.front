/** Quita acentos y normaliza mayúsculas — mismo criterio que `app/geo/matching.py`
 * en el backend, para matchear nombres de departamento contra el GeoJSON. */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFKD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '')
    .trim()
    .toLowerCase()
}
