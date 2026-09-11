// Ficha de municipio (imprimible) — junta datos de 5 fuentes para un municipio y
// arma un PDF y un Excel. Todo client-side, con el token del usuario.

import apiClient from '../../shared/api/client'
import { exportToXlsx } from '../../shared/utils/exportTable'
import { cordobaHogarApi, cordonCunetaApi, miLugarApi } from '../vivienda/api/vivienda.api'
import type { EstadoCC, EstadoCH, EstadoML } from '../vivienda/types/vivienda.types'
import { fichaLocalidadApi } from './api/fichaLocalidad.api'

const norm = (s: string) =>
  (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('es-AR'))
const fmtFecha = (s: string | null | undefined) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('es-AR') } catch { return s }
}
const semLabel = (c?: string | null) =>
  c ? ({ verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo' } as Record<string, string>)[c.toLowerCase()] ?? c : '—'

/** avance ≈ posición del estado_general en su catálogo (0–100 %). */
function avancePct(estadoId: number | null | undefined, estados: { id: number; orden: number }[]): string {
  if (estadoId == null || !estados.length) return '—'
  const e = estados.find((x) => x.id === estadoId)
  if (!e) return '—'
  const ords = estados.map((x) => x.orden)
  const min = Math.min(...ords), max = Math.max(...ords)
  if (max === min) return '—'
  return `${Math.round(((e.orden - min) / (max - min)) * 100)}%`
}
const labelEstado = (id: number | null | undefined, estados: { id: number; label: string }[]) =>
  id == null ? '—' : (estados.find((e) => e.id === id)?.label ?? '—')
const bgEstado = (id: number | null | undefined, estados: { id: number; bg?: string }[]) =>
  (id == null ? null : (estados.find((e) => e.id === id)?.bg ?? null)) || null

// Fila de gestión ya procesada para la ficha. `categoria_general_id`,
// `campo_trabajo`, `ministerio_agencia` y `tipo_gestion` ya vienen resueltos a
// nombre. `estado`/`urgencia` se conservan aunque el PDF ya no los muestre —
// los sigue usando `fichaMunicipioXlsx`.
interface GestionFila {
  id_gestion: string
  categoria_general_id?: string   // "Categoría General" (catálogo)
  campo_trabajo?: string          // "Categoría" = Campo de Trabajo (categoria_id, catálogo editable)
  ministerio_agencia?: string     // "Ministerio / Agencia" (catálogo)
  tipo_gestion?: string           // "Tipo de Gestión" (catálogo, con fallback al valor crudo)
  derivado_a?: string             // del evento más reciente con metadata_json.derivado_a
  costo_estimado?: number | null  // "Monto"
  detalle: string
  fecha_ingreso: string
  dias_transcurridos?: number | null
  estado: string
  urgencia?: string
  nro_expediente?: string | null
  ultimo_mov: string
}

// Forma cruda de un item de GET /api/v1/privada/gestiones (subset que usa la ficha).
interface GestionApiItem {
  id_gestion: string
  categoria_general_id?: string | null
  categoria_id?: number | null
  ministerio_agencia_id?: string | null
  tipo_gestion?: string | null
  costo_estimado?: number | null
  detalle?: string | null
  fecha_ingreso?: string | null
  dias_transcurridos?: number | null
  estado?: string | null
  urgencia?: string | null
  nro_expediente?: string | null
}

export interface FichaMunicipio {
  departamento: string
  localidad: string
  demografica: {
    color_semaforo: string
    tipo_localidad: string
    habitantes: string
    electores: string
    intendente: string
    partido: string
  }
  cordobaHogar: null | { fecha_anuncio: string; monto: string; casas: string; ok_gob: string; estado_general: string; estado_bg: string | null; avance: string }
  cordonCuneta: null | { monto: string; estado_general: string; estado_bg: string | null; updated_at: string; volumen: string; avance: string; ok_gob: string }
  miLugar: { lotes: string; monto: string; etecnico: string; ejuridico: string; efinanciero: string; estado_general: string; estado_bg: string | null; avance: string; updated_at: string; ok_gob: string }[]
  gestiones: { total: number; filas: GestionFila[] }
}

async function catCategoriasMap(): Promise<Map<string, string>> {
  const data = await apiClient.get<{ id: string; nombre: string }[]>('/api/v1/privada/catalogos/categorias').then((r) => r.data)
  return new Map((data ?? []).map((c) => [c.id, c.nombre]))
}

/** Mapa id→nombre de un catálogo simple de Privada (`ministerios`, `tipos-gestion`, …). */
async function catalogoNombreMap(nombre: string): Promise<Map<string, string>> {
  const data = await apiClient.get<{ id: string; nombre: string }[]>(`/api/v1/privada/catalogos/${nombre}`).then((r) => r.data)
  return new Map((data ?? []).map((c) => [c.id, c.nombre]))
}

/** Mapa id→label del catálogo editable "categorias" (E1) = Campo de Trabajo. */
async function campoTrabajoMap(): Promise<Map<number, string>> {
  const data = await apiClient.get<{ id: number; label: string }[]>('/api/v1/privada/categorias').then((r) => r.data)
  return new Map((data ?? []).map((c) => [c.id, c.label]))
}

/** Del registro de eventos de una gestión: última fecha de evento + `derivado_a`
 *  (metadata_json del evento más reciente que lo tenga). */
async function movimientosDeGestion(idGestion: string): Promise<{ ultimo_mov: string; derivado_a: string }> {
  try {
    const data = await apiClient
      .get<{ fecha_evento?: string | null; metadata_json?: unknown }[]>(`/api/v1/privada/gestiones/${idGestion}/eventos`)
      .then((r) => r.data)
    const evs = [...(data ?? [])].sort((a, b) => (b.fecha_evento ?? '').localeCompare(a.fecha_evento ?? ''))
    const ultimo_mov = evs.length ? (evs[0].fecha_evento ?? '').slice(0, 10) : ''
    let derivado_a = ''
    for (const ev of evs) {
      let meta: unknown = ev.metadata_json
      if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch { meta = null } }
      const d = (meta as { derivado_a?: unknown } | null)?.derivado_a
      if (typeof d === 'string' && d.trim()) { derivado_a = d.trim(); break }
    }
    return { ultimo_mov, derivado_a }
  } catch {
    return { ultimo_mov: '', derivado_a: '' }
  }
}

/** Junta toda la ficha para (departamento, localidad). */
export async function armarFichaMunicipio(departamento: string, localidad: string): Promise<FichaMunicipio> {
  const nl = norm(localidad)
  const [li, chPanel, ccPanel, mlProyectos, mlEstados, gestResp, catMap, minMap, tipoMap, campoMap] = await Promise.all([
    fichaLocalidadApi.localidad(departamento, localidad).catch(() => null),
    cordobaHogarApi.getPanel().catch(() => null),
    cordonCunetaApi.getPanel().catch(() => null),
    miLugarApi.getProyectos({ localidad_nombre: localidad }).catch(() => [] as Awaited<ReturnType<typeof miLugarApi.getProyectos>>),
    miLugarApi.getEstados().catch(() => [] as EstadoML[]),
    apiClient.get<{ items: GestionApiItem[]; total: number }>('/api/v1/privada/gestiones', {
      params: { departamento, localidad, limit: 200 },
    }).then((r) => r.data).catch(() => ({ items: [] as GestionApiItem[], total: 0 })),
    catCategoriasMap().catch(() => new Map<string, string>()),
    catalogoNombreMap('ministerios').catch(() => new Map<string, string>()),
    catalogoNombreMap('tipos-gestion').catch(() => new Map<string, string>()),
    campoTrabajoMap().catch(() => new Map<number, string>()),
  ])

  const chEstados: EstadoCH[] = chPanel?.estados ?? []
  const ccEstados: EstadoCC[] = ccPanel?.estados ?? []

  const chRow = (chPanel?.localidades ?? []).find((x) => norm(x.localidad) === nl)
  const ccRow = (ccPanel?.municipios ?? []).find((x) => norm(x.municipio) === nl)
  const mlRows = (mlProyectos ?? []).filter((p) => norm(p.localidad_nombre) === nl)

  // Por gestión: último movimiento (join por id_gestión, evento más reciente por
  // fecha_evento) + "Derivado A" (metadata_json.derivado_a del último evento que lo tenga).
  const items = gestResp.items ?? []
  const movs = await Promise.all(items.map((g) => movimientosDeGestion(g.id_gestion)))

  return {
    departamento,
    localidad,
    demografica: {
      color_semaforo: semLabel(li?.color_semaforo),
      tipo_localidad: li?.tipo_localidad ?? '—',
      habitantes: fmtNum(li?.habitantes),
      electores: fmtNum(li?.electores),
      intendente: li?.intendente_jefe_comunal ?? '—',
      partido: li?.partido_politico ?? '—',
    },
    cordobaHogar: chRow ? {
      fecha_anuncio: fmtFecha(chRow.fecha_anuncio),
      monto: fmtNum(chRow.monto),
      casas: fmtNum(chRow.cantidad_casas),
      ok_gob: chRow.ok_gob || '—',
      estado_general: labelEstado(chRow.estado_general, chEstados),
      estado_bg: bgEstado(chRow.estado_general, chEstados),
      avance: avancePct(chRow.estado_general, chEstados),
    } : null,
    cordonCuneta: ccRow ? {
      monto: fmtNum(ccRow.monto),
      estado_general: labelEstado(ccRow.estado_general, ccEstados),
      estado_bg: bgEstado(ccRow.estado_general, ccEstados),
      updated_at: fmtFecha(ccRow.updated_at),
      volumen: [
        ccRow.cordon_cuneta_ml != null ? `${fmtNum(ccRow.cordon_cuneta_ml)} m (cordón cuneta)` : null,
        ccRow.adoquinado_m2 != null ? `${fmtNum(ccRow.adoquinado_m2)} m² (adoquinado)` : null,
      ].filter(Boolean).join(' · ') || '—',
      avance: avancePct(ccRow.estado_general, ccEstados),
      ok_gob: ccRow.ok_gob || '—',
    } : null,
    miLugar: mlRows.map((p) => ({
      lotes: fmtNum(p.lotes),
      monto: fmtNum(p.monto),
      etecnico: labelEstado(p.etecnico, mlEstados),
      ejuridico: labelEstado(p.ejuridico, mlEstados),
      efinanciero: labelEstado(p.efinanciero, mlEstados),
      estado_general: labelEstado(p.estado_general, mlEstados),
      estado_bg: bgEstado(p.estado_general, mlEstados),
      avance: avancePct(p.estado_general, mlEstados),
      updated_at: fmtFecha(p.updated_at),
      ok_gob: p.ok_gob || '—',
    })),
    gestiones: {
      total: gestResp.total ?? items.length,
      filas: items.map((g, i) => ({
        id_gestion: g.id_gestion,
        categoria_general_id: catMap.get(g.categoria_general_id ?? '') ?? g.categoria_general_id ?? '—',
        campo_trabajo: g.categoria_id != null ? (campoMap.get(g.categoria_id) ?? '—') : '—',
        ministerio_agencia: minMap.get(g.ministerio_agencia_id ?? '') ?? g.ministerio_agencia_id ?? '—',
        tipo_gestion: tipoMap.get(g.tipo_gestion ?? '') ?? g.tipo_gestion ?? '—',
        derivado_a: movs[i].derivado_a,
        costo_estimado: g.costo_estimado ?? null,
        detalle: g.detalle ?? '',
        fecha_ingreso: (g.fecha_ingreso ?? '').slice(0, 10),
        dias_transcurridos: g.dias_transcurridos,
        estado: g.estado ?? '',
        urgencia: g.urgencia ?? undefined,
        nro_expediente: g.nro_expediente,
        ultimo_mov: movs[i].ultimo_mov,
      })),
    },
  }
}

// ── PDF ─────────────────────────────────────────────────────────────────────
const RGB = (hex: string): [number, number, number] => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [148, 163, 184]
}

export async function fichaMunicipioPdf(f: FichaMunicipio): Promise<void> {
  const [{ jsPDF }, { HERALDICO_PNG }] = await Promise.all([
    import('jspdf'), import('./heraldico'),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 56              // ~2 cm
  const W = PW - M * 2
  const VALX = M + 190      // columna de valores
  const BOTTOM = PH - 64    // reserva para el pie
  const NAVY: [number, number, number] = [23, 44, 63]
  const GRAY: [number, number, number] = [110, 116, 122]
  const INK: [number, number, number] = [33, 37, 41]
  const SEM: Record<string, [number, number, number]> = {
    verde: [46, 125, 50], amarillo: [249, 168, 37], rojo: [198, 40, 40],
  }
  let y = M

  const ensure = (space: number) => { if (y + space > BOTTOM) { doc.addPage(); y = M } }
  const setInk = () => doc.setTextColor(...INK)

  const heading = (t: string) => {
    ensure(46)
    y += 18
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...NAVY)
    doc.text(t.toUpperCase(), M, y)
    y += 6
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.8); doc.line(M, y, M + W, y)
    y += 15
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  }
  const kv = (k: string, v: string, chipHex?: string | null) => {
    ensure(16)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    doc.setTextColor(...GRAY); doc.text(k, M, y)
    let x = VALX
    if (chipHex) { doc.setFillColor(...RGB(chipHex)); doc.circle(VALX + 4, y - 3, 4, 'F'); x = VALX + 14 }
    setInk(); doc.setFontSize(10)
    doc.text(doc.splitTextToSize(v || '—', W - (x - M)) as string[], x, y)
    y += 15
  }
  const semaforoKv = (label: string) => {
    ensure(16)
    doc.setFontSize(9.5); doc.setTextColor(...GRAY); doc.text('Semáforo', M, y)
    const c = SEM[label.toLowerCase()]
    if (c) { doc.setFillColor(...c); doc.circle(VALX + 4, y - 3, 4, 'F') }
    setInk(); doc.setFontSize(10); doc.text(label || '—', VALX + (c ? 14 : 0), y)
    y += 15
  }
  const vacio = () => { ensure(16); doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...GRAY); doc.text('Sin datos cargados', M, y); doc.setFont('helvetica', 'normal'); y += 15 }

  const hoy = new Date().toLocaleDateString('es-AR')

  // ── Encabezado con membrete ──
  const logoH = 48, logoW = logoH * (186 / 218)
  try { doc.addImage(HERALDICO_PNG, 'PNG', M, y, logoW, logoH) } catch { /* sin logo */ }
  const hx = M + logoW + 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GRAY)
  doc.text('GOBIERNO DE LA PROVINCIA DE CÓRDOBA · SECRETARÍA GENERAL DE GOBIERNO', hx, y + 6)
  doc.setFontSize(7); doc.text('FICHA DE MUNICIPIO', hx, y + 17)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...NAVY)
  doc.text(doc.splitTextToSize(f.localidad, W - (hx - M)) as string[], hx, y + 36)
  y += Math.max(logoH, 40) + 20
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY)
  doc.text(
    `${f.departamento}${f.demografica.tipo_localidad !== '—' ? `  ·  Tipo ${f.demografica.tipo_localidad}` : ''}  ·  Datos al ${hoy}`,
    M, y,
  )
  y += 8
  doc.setDrawColor(...NAVY); doc.setLineWidth(1.4); doc.line(M, y, M + W, y)
  y += 14

  // ── Franja de KPIs ──
  const progDgv = (f.cordobaHogar ? 1 : 0) + (f.cordonCuneta ? 1 : 0) + f.miLugar.length
  const kpis: [string, string][] = [
    ['Habitantes', f.demografica.habitantes],
    ['Electores', f.demografica.electores],
    ['Gestiones', String(f.gestiones.total)],
    ['Programas DGV', String(progDgv)],
  ]
  const kw = (W - 3 * 10) / 4, kh = 40
  kpis.forEach(([lab, val], i) => {
    const x = M + i * (kw + 10)
    doc.setDrawColor(210); doc.setLineWidth(0.7); doc.roundedRect(x, y, kw, kh, 3, 3)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...NAVY)
    doc.text(val, x + 8, y + 20)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY)
    doc.text(lab.toUpperCase(), x + 8, y + 32)
  })
  y += kh

  // ── Ficha Demográfica ──
  heading('Ficha Demográfica')
  semaforoKv(f.demografica.color_semaforo)
  kv('Habitantes', f.demografica.habitantes)
  kv('Electores', f.demografica.electores)
  kv('Intendente / Jefe Comunal', f.demografica.intendente)
  kv('Partido Político', f.demografica.partido)

  heading('Córdoba Hogar · DGV')
  if (f.cordobaHogar) {
    kv('Fecha de anuncio', f.cordobaHogar.fecha_anuncio)
    kv('Monto', f.cordobaHogar.monto)
    kv('Casas', f.cordobaHogar.casas)
    kv('Ok Ministro', f.cordobaHogar.ok_gob)
    kv('Estado General', f.cordobaHogar.estado_general, f.cordobaHogar.estado_bg)
    kv('Porcentaje de avance', f.cordobaHogar.avance)
  } else vacio()

  heading('Cordón Cuneta · DGV')
  if (f.cordonCuneta) {
    kv('Monto', f.cordonCuneta.monto)
    kv('Estado General', f.cordonCuneta.estado_general, f.cordonCuneta.estado_bg)
    kv('Última modificación', f.cordonCuneta.updated_at)
    kv('Volumen', f.cordonCuneta.volumen)
    kv('Porcentaje de avance', f.cordonCuneta.avance)
    kv('Ok Gobernador', f.cordonCuneta.ok_gob)
  } else vacio()

  heading('Programa Mi Lugar · DGV')
  if (f.miLugar.length) {
    f.miLugar.forEach((m, i) => {
      if (i) { ensure(10); y += 8 }
      kv('Lotes', m.lotes)
      kv('Monto', m.monto)
      kv('Estado Técnico', m.etecnico)
      kv('Estado Jurídico', m.ejuridico)
      kv('Estado Presupuestario', m.efinanciero)
      kv('Estado General', m.estado_general, m.estado_bg)
      kv('Porcentaje de avance', m.avance)
      kv('Última modificación', m.updated_at)
      kv('Ok Gobernador', m.ok_gob)
    })
  } else vacio()

  // ── Gestiones ──
  // Siempre en bloque vertical (etiqueta / valor), una gestión tras otra.
  heading(`Gestiones — Demandas Subsecretaría de Municipios  |  Total ${f.gestiones.total}`)
  if (!f.gestiones.filas.length) {
    vacio()
  } else {
    f.gestiones.filas.forEach((g, i) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
      const detLns = doc.splitTextToSize(`Detalle: ${g.detalle || '—'}`, W) as string[]
      ensure(120 + detLns.length * 12 + (i ? 24 : 0))
      if (i && y > M) {
        y += 8
        doc.setDrawColor(220); doc.setLineWidth(0.6); doc.line(M, y, M + W, y)
        y += 16
      }
      // Campo de Trabajo (categoria_id, catálogo editable) — encabeza el bloque
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setInk()
      doc.text(doc.splitTextToSize(`Campo de Trabajo: ${g.campo_trabajo || '—'}`, W) as string[], M, y); y += 14
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK)
      doc.text(detLns, M, y); y += detLns.length * 12
      doc.setTextColor(...GRAY)
      doc.text(`Fecha de ingreso: ${g.fecha_ingreso || '—'}   |   Días transcurridos: ${g.dias_transcurridos ?? '—'}`, M, y); y += 12
      doc.text(`Ministerio / Agencia: ${g.ministerio_agencia || '—'}`, M, y); y += 12
      doc.text(`Categoría General: ${g.categoria_general_id || '—'}`, M, y); y += 12
      doc.text(`Tipo de Gestión: ${g.tipo_gestion || '—'}`, M, y); y += 12
      doc.text(`Último movimiento: ${g.ultimo_mov || '—'}`, M, y); y += 12
      doc.text(`Derivado A: ${g.derivado_a || '—'}`, M, y); y += 12
      doc.text(`Monto: ${g.costo_estimado != null ? fmtNum(g.costo_estimado) : '—'}`, M, y); y += 12
      doc.text(`Nro expediente: ${g.nro_expediente || 'Sin Expediente'}`, M, y); y += 4
    })
  }

  // ── Pie de página en todas las hojas ──
  const total = doc.getNumberOfPages()
  const gen = new Date().toLocaleString('es-AR')
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY)
    doc.text(`Generado ${gen}`, M, PH - 36)
    doc.text(`Página ${p} de ${total}`, PW - M, PH - 36, { align: 'right' })
    doc.setDrawColor(220); doc.setLineWidth(0.5); doc.line(M, PH - 48, PW - M, PH - 48)
  }

  doc.save(`ficha_${norm(f.localidad).replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Excel ───────────────────────────────────────────────────────────────────
export function fichaMunicipioXlsx(f: FichaMunicipio): void {
  const cab: Record<string, unknown>[] = [
    { Campo: 'Localidad', Valor: f.localidad },
    { Campo: 'Departamento', Valor: f.departamento },
    { Campo: 'Tipo localidad', Valor: f.demografica.tipo_localidad },
    { Campo: 'Semáforo', Valor: f.demografica.color_semaforo },
    { Campo: 'Habitantes', Valor: f.demografica.habitantes },
    { Campo: 'Electores', Valor: f.demografica.electores },
    { Campo: 'Intendente / Jefe Comunal', Valor: f.demografica.intendente },
    { Campo: 'Partido Político', Valor: f.demografica.partido },
    {},
    { Campo: 'Córdoba Hogar', Valor: f.cordobaHogar ? '' : '—' },
    ...(f.cordobaHogar ? [
      { Campo: '  Fecha de anuncio', Valor: f.cordobaHogar.fecha_anuncio },
      { Campo: '  Monto', Valor: f.cordobaHogar.monto },
      { Campo: '  Casas', Valor: f.cordobaHogar.casas },
      { Campo: '  Ok Ministro', Valor: f.cordobaHogar.ok_gob },
      { Campo: '  Estado General', Valor: f.cordobaHogar.estado_general },
      { Campo: '  Avance', Valor: f.cordobaHogar.avance },
    ] : []),
    {},
    { Campo: 'Cordón Cuneta', Valor: f.cordonCuneta ? '' : '—' },
    ...(f.cordonCuneta ? [
      { Campo: '  Monto', Valor: f.cordonCuneta.monto },
      { Campo: '  Estado General', Valor: f.cordonCuneta.estado_general },
      { Campo: '  Última modificación', Valor: f.cordonCuneta.updated_at },
      { Campo: '  Volumen', Valor: f.cordonCuneta.volumen },
      { Campo: '  Avance', Valor: f.cordonCuneta.avance },
    ] : []),
    {},
    { Campo: 'Mi Lugar', Valor: f.miLugar.length ? '' : '—' },
    ...f.miLugar.flatMap((m, i) => [
      { Campo: `  Proyecto ${i + 1} — Lotes`, Valor: m.lotes },
      { Campo: '  Monto', Valor: m.monto },
      { Campo: '  Estado Técnico', Valor: m.etecnico },
      { Campo: '  Estado Jurídico', Valor: m.ejuridico },
      { Campo: '  Estado Presupuestario', Valor: m.efinanciero },
      { Campo: '  Estado General', Valor: m.estado_general },
      { Campo: '  Avance', Valor: m.avance },
      { Campo: '  Última modificación', Valor: m.updated_at },
    ]),
  ]
  const gest = f.gestiones.filas.map((g) => ({
    Categoría: g.categoria_general_id,
    Detalle: g.detalle,
    'Fecha de ingreso': g.fecha_ingreso,
    'Días transcurridos': g.dias_transcurridos ?? '',
    Estado: g.estado,
    Urgencia: g.urgencia ?? '',
    'Último movimiento': g.ultimo_mov || '',
    'Nro expediente': g.nro_expediente || 'Sin Expediente',
  }))
  // dos hojas: ficha (clave/valor) y gestiones (tabla) — exportToXlsx sólo hace 1 hoja,
  // así que apilamos: primero la ficha, una fila en blanco, luego la tabla de gestiones.
  const filas: Record<string, unknown>[] = [
    ...cab,
    {},
    { Campo: `Gestiones — Total ${f.gestiones.total}`, Valor: '' },
    ...gest.map((g) => ({ Campo: g.Categoría, Valor: `${g.Detalle} | ${g.Estado} | ${g['Fecha de ingreso']} | exp ${g['Nro expediente']}` })),
  ]
  exportToXlsx(filas, 'Ficha municipio', `ficha_${norm(f.localidad).replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
