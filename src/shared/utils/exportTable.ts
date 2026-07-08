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
