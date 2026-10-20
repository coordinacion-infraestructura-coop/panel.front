// Formatos del tablero. Los montos llegan en pesos; se muestran en millones ("M") o en miles
// de millones ("mil M"), como el Looker.

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fmtMonto(pesos: number | null | undefined): string {
  if (pesos == null) return '—'
  const m = pesos / 1e6
  if (Math.abs(m) >= 1000) return `$ ${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil M`
  return `$ ${m.toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
}

export const fmtPesos = (v: number | null | undefined) => (v == null ? '—' : `$ ${Math.round(v).toLocaleString('es-AR')}`)
export const fmtN = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('es-AR'))
export const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`
export const fmtVariacion = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`

/** "2026-08-01" → "agosto 2026". */
export function fmtPeriodo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m] = iso.split('-').map(Number)
  return `${MESES_LARGOS[m - 1]} ${a}`
}

export const fmtFecha = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR') : '—'
