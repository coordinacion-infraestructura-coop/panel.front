import * as XLSX from 'xlsx'

/**
 * Exports an array of plain objects to an .xlsx file.
 * Keys of each object become column headers in the first sheet.
 *
 * @param rows    Pre-mapped objects where keys = column headers, values = cell content
 * @param sheet   Name shown on the Excel tab (max 31 chars)
 * @param filename Output filename, e.g. "municipios_cc.xlsx"
 */
export function exportToXlsx(
  rows: Record<string, unknown>[],
  sheet: string,
  filename: string,
): void {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  XLSX.writeFile(wb, filename)
}

/**
 * Exports several sheets to a single .xlsx workbook.
 * Each entry becomes one tab; `rows` keys are the column headers of that tab.
 * Sheets with no rows are still added (with a single "sin datos" marker) so the
 * workbook layout stays stable across exports.
 *
 * @param sheets   Ordered list of `{ name, rows }` — `name` is truncated to 31 chars.
 * @param filename Output filename, e.g. "resumen_territorial_2026-09-03.xlsx"
 */
export function exportSheetsToXlsx(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string,
): void {
  const wb = XLSX.utils.book_new()
  const usados = new Set<string>()
  for (const { name, rows } of sheets) {
    let tab = (name || 'Hoja').slice(0, 31)
    let n = 2
    while (usados.has(tab)) tab = `${name.slice(0, 28)}_${n++}`
    usados.add(tab)
    const data = rows.length ? rows : [{ '': 'Sin datos para los filtros aplicados' }]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), tab)
  }
  XLSX.writeFile(wb, filename)
}
