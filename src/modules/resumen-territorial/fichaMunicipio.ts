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

interface GestionFila {
  id_gestion: string
  categoria_general_id?: string
  detalle: string
  fecha_ingreso: string
  dias_transcurridos?: number | null
  estado: string
  urgencia?: string
  nro_expediente?: string | null
  ultimo_mov: string
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
  cordobaHogar: null | { fecha_anuncio: string; monto: string; casas: string; ok_gob: string; estado_general: string; avance: string }
  cordonCuneta: null | { monto: string; estado_general: string; updated_at: string; volumen: string; avance: string }
  miLugar: { lotes: string; monto: string; etecnico: string; ejuridico: string; efinanciero: string; estado_general: string; avance: string; updated_at: string }[]
  gestiones: { total: number; filas: GestionFila[] }
}

async function catCategoriasMap(): Promise<Map<string, string>> {
  const data = await apiClient.get<{ id: string; nombre: string }[]>('/api/v1/privada/catalogos/categorias').then((r) => r.data)
  return new Map((data ?? []).map((c) => [c.id, c.nombre]))
}

/** Junta toda la ficha para (departamento, localidad). */
export async function armarFichaMunicipio(departamento: string, localidad: string): Promise<FichaMunicipio> {
  const nl = norm(localidad)
  const [li, chPanel, ccPanel, mlProyectos, mlEstados, gestResp, catMap] = await Promise.all([
    fichaLocalidadApi.localidad(departamento, localidad).catch(() => null),
    cordobaHogarApi.getPanel().catch(() => null),
    cordonCunetaApi.getPanel().catch(() => null),
    miLugarApi.getProyectos({ localidad_nombre: localidad }).catch(() => [] as Awaited<ReturnType<typeof miLugarApi.getProyectos>>),
    miLugarApi.getEstados().catch(() => [] as EstadoML[]),
    apiClient.get<{ items: GestionFila[]; total: number }>('/api/v1/privada/gestiones', {
      params: { departamento, localidad, limit: 200 },
    }).then((r) => r.data).catch(() => ({ items: [] as GestionFila[], total: 0 })),
    catCategoriasMap().catch(() => new Map<string, string>()),
  ])

  const chEstados: EstadoCH[] = chPanel?.estados ?? []
  const ccEstados: EstadoCC[] = ccPanel?.estados ?? []

  const chRow = (chPanel?.localidades ?? []).find((x) => norm(x.localidad) === nl)
  const ccRow = (ccPanel?.municipios ?? []).find((x) => norm(x.municipio) === nl)
  const mlRows = (mlProyectos ?? []).filter((p) => norm(p.localidad_nombre) === nl)

  // Último movimiento por gestión (último evento por fecha_evento, o vacío).
  const items = gestResp.items ?? []
  const movs = await Promise.all(items.map((g) =>
    apiClient.get<{ fecha_evento: string }[]>(`/api/v1/privada/gestiones/${g.id_gestion}/eventos`)
      .then((r) => {
        const evs = [...(r.data ?? [])].sort((a, b) => (b.fecha_evento ?? '').localeCompare(a.fecha_evento ?? ''))
        return evs.length ? (evs[0].fecha_evento ?? '').slice(0, 10) : ''
      })
      .catch(() => ''),
  ))

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
      avance: avancePct(chRow.estado_general, chEstados),
    } : null,
    cordonCuneta: ccRow ? {
      monto: fmtNum(ccRow.monto),
      estado_general: labelEstado(ccRow.estado_general, ccEstados),
      updated_at: fmtFecha(ccRow.updated_at),
      volumen: [
        ccRow.cordon_cuneta_ml != null ? `${fmtNum(ccRow.cordon_cuneta_ml)} m (cordón cuneta)` : null,
        ccRow.adoquinado_m2 != null ? `${fmtNum(ccRow.adoquinado_m2)} m² (adoquinado)` : null,
      ].filter(Boolean).join(' · ') || '—',
      avance: avancePct(ccRow.estado_general, ccEstados),
    } : null,
    miLugar: mlRows.map((p) => ({
      lotes: fmtNum(p.lotes),
      monto: fmtNum(p.monto),
      etecnico: labelEstado(p.etecnico, mlEstados),
      ejuridico: labelEstado(p.ejuridico, mlEstados),
      efinanciero: labelEstado(p.efinanciero, mlEstados),
      estado_general: labelEstado(p.estado_general, mlEstados),
      avance: avancePct(p.estado_general, mlEstados),
      updated_at: fmtFecha(p.updated_at),
    })),
    gestiones: {
      total: gestResp.total ?? items.length,
      filas: items.map((g, i) => ({
        id_gestion: g.id_gestion,
        categoria_general_id: catMap.get(g.categoria_general_id ?? '') ?? g.categoria_general_id ?? '—',
        detalle: g.detalle,
        fecha_ingreso: (g.fecha_ingreso ?? '').slice(0, 10),
        dias_transcurridos: g.dias_transcurridos,
        estado: g.estado,
        urgencia: g.urgencia,
        nro_expediente: g.nro_expediente,
        ultimo_mov: movs[i],
      })),
    },
  }
}

// ── PDF ─────────────────────────────────────────────────────────────────────
export async function fichaMunicipioPdf(f: FichaMunicipio): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  let y = 56
  const W = doc.internal.pageSize.getWidth() - M * 2

  const nl = () => { y += 15; if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 56 } }
  const h = (t: string) => { nl(); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(t, M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(10) }
  const kv = (k: string, v: string) => { doc.text(`${k}: `, M + 12, y); doc.text(v || '—', M + 150, y); nl() }
  const line = (t: string) => { doc.text(doc.splitTextToSize(t, W), M, y); nl() }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text('Ficha de Municipio', M, y); nl()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text(`${f.localidad}  ·  ${f.departamento}  ·  Tipo: ${f.demografica.tipo_localidad}`, M, y); nl(); nl()
  doc.setFontSize(10)

  h('Ficha Demográfica')
  kv('Semáforo', f.demografica.color_semaforo)
  kv('Habitantes', f.demografica.habitantes)
  kv('Electores', f.demografica.electores)
  kv('Intendente / Jefe Comunal', f.demografica.intendente)
  kv('Partido Político', f.demografica.partido)

  h('Córdoba Hogar DGV')
  if (f.cordobaHogar) {
    kv('Fecha de anuncio', f.cordobaHogar.fecha_anuncio)
    kv('Monto', f.cordobaHogar.monto)
    kv('Casas', f.cordobaHogar.casas)
    kv('Ok Ministro', f.cordobaHogar.ok_gob)
    kv('Estado General', f.cordobaHogar.estado_general)
    kv('Porcentaje de avance', f.cordobaHogar.avance)
  } else line('—')

  h('Cordón Cuneta DGV')
  if (f.cordonCuneta) {
    kv('Monto', f.cordonCuneta.monto)
    kv('Estado General', f.cordonCuneta.estado_general)
    kv('Última modificación', f.cordonCuneta.updated_at)
    kv('Volumen', f.cordonCuneta.volumen)
    kv('Porcentaje de avance', f.cordonCuneta.avance)
  } else line('—')

  h('Programa Mi Lugar DGV')
  if (f.miLugar.length) {
    f.miLugar.forEach((m, i) => {
      if (i) nl()
      kv('Lotes', m.lotes)
      kv('Monto', m.monto)
      kv('Estado Técnico', m.etecnico)
      kv('Estado Jurídico', m.ejuridico)
      kv('Estado Presupuestario', m.efinanciero)
      kv('Estado General', m.estado_general)
      kv('Porcentaje de avance', m.avance)
      kv('Última modificación', m.updated_at)
    })
  } else line('—')

  nl()
  h(`Gestiones — Demandas Subsecretaría de Municipios  |  Total: ${f.gestiones.total}`)
  nl()
  f.gestiones.filas.forEach((g, i) => {
    if (i) { doc.setDrawColor(200); doc.line(M, y - 4, M + W, y - 4); nl() }
    line(`Categoría: ${g.categoria_general_id}`)
    line(`Detalle: ${g.detalle}`)
    line(`Fecha de ingreso: ${g.fecha_ingreso}   Días transcurridos: ${g.dias_transcurridos ?? '—'}`)
    line(`Estado: ${g.estado}`)
    line(`Urgencia: ${g.urgencia ?? '—'}`)
    line(`Último movimiento: ${g.ultimo_mov || ''}`)
    line(`Nro expediente: ${g.nro_expediente || 'Sin Expediente'}`)
  })

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
