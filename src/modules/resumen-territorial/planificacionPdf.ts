// Planilla imprimible de la planificación de programas (spec-privada-planificacion-programas.md
// §8). Es para control manual: el funcionario la imprime filtrada (casi siempre un departamento
// o una localidad) y marca con lapicera. Estética simple a propósito: título en negrita, nombres
// de columna, datos, el color del estado (o de la prioridad) en cada fila, y una columna vacía
// para el check.

import type { Columna, Estado, FilaPlan, Prioridad, Programa } from './api/planificacion.api'
import { generoIntendente } from './api/planificacion.api'

type RGB = [number, number, number]
const rgb = (hex: string | null | undefined): RGB | undefined => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec((hex ?? '').trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined
}
const fmtNum = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('es-AR'))
const fmtFecha = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const fmtMonto = (n: number | null | undefined) => {
  if (n == null) return ''
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  return `$${n.toLocaleString('es-AR')}`
}
const siNo = (v: boolean | null | undefined) => (v == null ? '' : v ? 'Sí' : 'No')

export interface ImpresionPlanificacion {
  programa: Programa
  filas: FilaPlan[]
  /** Nombre en negrita del encabezado: el departamento o la localidad filtrada. */
  titulo: string
  /** Filtros aplicados, en texto (va debajo del título). */
  filtros: string
  prioridades: Prioridad[]
  estados: Estado[]
  columnas: Columna[]
}

export async function imprimirPlanificacion(p: ImpresionPlanificacion): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 28
  const prioById = new Map(p.prioridades.map((x) => [x.id, x]))
  const estById = new Map(p.estados.map((x) => [x.id, x]))
  const conPanel = !!p.programa.fuente

  // ── encabezado ──
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Planificación de programas — ${p.programa.nombre}`, M, M + 4)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text(p.titulo, M, M + 24)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  const fecha = new Date().toLocaleDateString('es-AR')
  doc.text(`${p.filas.length} localidad(es) · ${p.filtros} · Impreso el ${fecha}`, M, M + 38)

  // Referencia de colores: sólo los que aparecen en las filas impresas.
  const usados: { nombre: string; bg: RGB; fg?: RGB }[] = []
  const vistos = new Set<string>()
  for (const f of p.filas) {
    const est = f.estado_id != null ? estById.get(f.estado_id) : undefined
    const pri = f.prioridad_id != null ? prioById.get(f.prioridad_id) : undefined
    const item = est?.color_bg ? { k: `e${est.id}`, nombre: est.nombre, bg: est.color_bg, fg: est.color_texto }
      : pri?.color_bg ? { k: `p${pri.id}`, nombre: `${pri.codigo} · ${pri.nombre}`, bg: pri.color_bg, fg: pri.color_texto }
      : null
    if (item && !vistos.has(item.k) && rgb(item.bg)) {
      vistos.add(item.k)
      usados.push({ nombre: item.nombre, bg: rgb(item.bg)!, fg: rgb(item.fg) })
    }
  }
  let x = M
  let y = M + 52
  doc.setFontSize(7.5)
  for (const u of usados) {
    const w = doc.getTextWidth(u.nombre) + 12
    if (x + w > PW - M) { x = M; y += 14 }
    doc.setFillColor(...u.bg); doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.4)
    doc.rect(x, y - 8, w, 11, 'FD')
    doc.setTextColor(...(u.fg ?? [0, 0, 0] as RGB))
    doc.text(u.nombre, x + 6, y)
    x += w + 6
  }
  doc.setTextColor(0, 0, 0)
  const startY = y + (usados.length ? 12 : 0)

  // ── tabla ──
  // La primera columna es la casilla de control (las fuentes base de jsPDF no tienen ✓).
  const head = [
    '', 'Localidad', 'Tipo', 'Habitantes', 'Copart. anual', 'Visita gob.', 'Semáforo', 'Intendente/a',
    ...(conPanel ? ['¿En el panel?', '¿Convenio?'] : []),
    'Prioridad', 'Estado', 'OK gob.',
    ...p.columnas.map((c) => c.nombre),
  ]
  const valorColumna = (c: Columna, v: unknown): string => {
    if (v == null || v === '') return ''
    if (typeof v === 'boolean') return v ? 'Sí' : 'No'
    if (c.tipo === 'monto') return fmtMonto(Number(v))
    if (c.tipo === 'numero') return fmtNum(Number(v))
    if (c.tipo === 'fecha') return fmtFecha(String(v))
    return String(v)
  }
  type Celda = string | { content: string; colSpan?: number; styles?: Record<string, unknown> }
  const body: Celda[][] = []
  const colorFila: (RGB | undefined)[] = []
  const textoFila: (RGB | undefined)[] = []
  const varios = new Set(p.filas.map((f) => f.departamento)).size > 1
  const ordenadas = varios
    ? [...p.filas].sort((a, b) => a.departamento.localeCompare(b.departamento, 'es'))
    : p.filas
  let depActual: string | null = null
  for (const f of ordenadas) {
    if (varios && f.departamento !== depActual) {
      depActual = f.departamento
      body.push([{ content: f.departamento, colSpan: head.length, styles: { fontStyle: 'bold', fontSize: 9, halign: 'left', fillColor: [235, 235, 235] } }])
      colorFila.push(undefined); textoFila.push(undefined)
    }
    const est = f.estado_id != null ? estById.get(f.estado_id) : undefined
    const pri = f.prioridad_id != null ? prioById.get(f.prioridad_id) : undefined
    // Misma regla que la pantalla (spec §4.3): color del estado; si no tiene, el de la prioridad.
    colorFila.push(rgb(est?.color_bg) ?? rgb(pri?.color_bg))
    textoFila.push(est?.color_bg ? rgb(est.color_texto) : rgb(pri?.color_texto))
    const panel = f.en_panel
      ? f.en_panel.estado === 'si'
        ? ['Sí', ...f.en_panel.lineas.map((l) => l.estado_general?.label).filter(Boolean)].join(' · ')
        : f.en_panel.estado === 'no' ? 'No' : 'Sin dato'
      : ''
    const ok = f.ok_gobernador_panel ?? f.ok_gobernador
    body.push([
      '',
      f.localidad,
      f.tipo_localidad ? f.tipo_localidad.slice(0, 1).toUpperCase() : '',
      fmtNum(f.habitantes),
      fmtMonto(f.coparticipacion_anual?.monto),
      f.visita_gobernador == null ? '' : f.visita_gobernador.visitada ? `Sí ${fmtFecha(f.visita_gobernador.fecha_ultima)}`.trim() : 'No',
      f.semaforo ?? '',
      generoIntendente(f),
      ...(conPanel ? [panel, f.convenio ? (f.convenio.firmado ? `Sí ${fmtFecha(f.convenio.fecha)}`.trim() : 'No') : ''] : []),
      pri?.nombre ?? '',
      est?.nombre ?? '',
      siNo(ok),
      ...p.columnas.map((c) => valorColumna(c, f.valores[c.clave])),
    ])
  }

  const derecha = new Set(['Habitantes', 'Copart. anual'])
  p.columnas.forEach((c) => { if (c.tipo === 'monto' || c.tipo === 'numero') derecha.add(c.nombre) })
  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: 18, halign: 'center' },
    1: { cellWidth: 95, fontStyle: 'bold' },
  }
  head.forEach((h, i) => { if (derecha.has(h)) columnStyles[i] = { ...(columnStyles[i] ?? {}), halign: 'right' } })
  p.columnas.forEach((c, j) => {
    if (c.tipo === 'texto_largo') columnStyles[head.length - p.columnas.length + j] = { cellWidth: 150 }
  })

  autoTable(doc, {
    startY,
    margin: { left: M, right: M, bottom: 30 },
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', textColor: [0, 0, 0], lineColor: [120, 120, 120], lineWidth: 0.4, valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.6 },
    columnStyles,
    didParseCell: (d) => {
      if (d.section !== 'body') return
      const bg = colorFila[d.row.index]
      if (bg && d.column.index > 0) d.cell.styles.fillColor = bg
      const fg = textoFila[d.row.index]
      if (bg && fg && d.column.index > 0) d.cell.styles.textColor = fg
    },
    didDrawCell: (d) => {
      // Casilla vacía para marcar con lapicera.
      if (d.section === 'body' && d.column.index === 0 && typeof d.cell.raw === 'string') {
        const s = 8
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.6)
        doc.rect(d.cell.x + (d.cell.width - s) / 2, d.cell.y + (d.cell.height - s) / 2, s, s)
      }
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 90, 90)
      doc.text(`${p.programa.nombre} — ${p.titulo} — ${fecha}`, M, PH - 14)
      doc.text(`Página ${doc.getNumberOfPages()}`, PW - M, PH - 14, { align: 'right' })
    },
  })

  const nombre = `${p.programa.nombre}_${p.titulo}`.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '_')
  doc.save(`planificacion_${nombre}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
