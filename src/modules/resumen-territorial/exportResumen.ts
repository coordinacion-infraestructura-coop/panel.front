// Export único del Resumen Territorial — un .xlsx multi-hoja con los municipios
// que cumplen los filtros aplicados en pantalla:
//   • Resumen      — alcance, filtros, totales, fecha de generación
//   • Programas     — una fila por (localidad, programa) con estado + checklist
//   • Checklists    — una fila por ítem faltante de cada checklist de vivienda
//   • Gestiones     — una fila por gestión de Sec. Privada de esas localidades
//   • Movimientos   — una fila por evento de esas gestiones (trackeo)
//
// Todo client-side con el token del usuario. Reemplaza a los ex-botones
// "⤓ Excel" / "⤓ PDF" / "⎙ Imprimir" (que mezclaban demografía por join
// difuso de nombre y salían con datos cruzados).

import apiClient from '../../shared/api/client'
import { exportSheetsToXlsx } from '../../shared/utils/exportTable'
import type { ResumenLocalidad } from './types/resumenTerritorial.types'

const norm = (s: string) =>
  (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const keyOf = (dep: string | null | undefined, loc: string) => `${norm(dep ?? '')}|${norm(loc)}`
const hoy = () => new Date().toISOString().slice(0, 10)
const fecha10 = (s: string | null | undefined) => (s ?? '').slice(0, 10)

// Tope de gestiones a las que se les traen los eventos uno por uno. Por encima
// de esto la hoja Movimientos sale con una nota y se omite el detalle (evita
// centenares de requests cuando se exporta sin filtros).
const MAX_GESTIONES_EVENTOS = 300
const CONCURRENCIA = 8

interface GestionItem {
  id_gestion: string
  departamento: string | null
  localidad: string | null
  estado: string | null
  urgencia: string | null
  categoria_general_id: string | null
  detalle: string | null
  nro_expediente: string | null
  fecha_ingreso: string | null
  dias_transcurridos: number | null
  ok_gobernador: string | null
  ok_ministro: string | null
}

interface EventoItem {
  fecha_evento: string | null
  usuario: string | null
  rol_usuario: string | null
  tipo_evento: string | null
  estado_anterior: string | null
  estado_nuevo: string | null
  campo_modificado: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  comentario: string | null
}

async function fetchTodasLasGestiones(): Promise<GestionItem[]> {
  const PAGE = 200
  const first = await apiClient
    .get<{ items: GestionItem[]; total: number }>('/api/v1/privada/gestiones/', {
      params: { limit: PAGE, offset: 0 },
    })
    .then((r) => r.data)
  const items = [...(first.items ?? [])]
  const total = first.total ?? items.length
  const pendientes: Promise<GestionItem[]>[] = []
  for (let offset = PAGE; offset < total; offset += PAGE) {
    pendientes.push(
      apiClient
        .get<{ items: GestionItem[] }>('/api/v1/privada/gestiones/', { params: { limit: PAGE, offset } })
        .then((r) => r.data.items ?? []),
    )
  }
  for (const chunk of await Promise.all(pendientes)) items.push(...chunk)
  return items
}

async function mapConLimite<T, R>(xs: T[], limite: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limite, xs.length) }, async () => {
      while (i < xs.length) {
        const idx = i++
        out[idx] = await fn(xs[idx])
      }
    }),
  )
  return out
}

async function catCategoriasMap(): Promise<Map<string, string>> {
  try {
    const data = await apiClient
      .get<{ id: string; nombre: string }[]>('/api/v1/privada/catalogos/categorias')
      .then((r) => r.data)
    return new Map((data ?? []).map((c) => [c.id, c.nombre]))
  } catch {
    return new Map()
  }
}

export interface ExportResumenMeta {
  alcance: string
  filtros: string
  incluirPrivada: boolean
}

/**
 * Arma y descarga el workbook. Devuelve un aviso (string) cuando hubo un tope
 * que recortó los movimientos, o `null` si salió completo.
 */
export async function exportarResumenXlsx(
  localidades: ResumenLocalidad[],
  meta: ExportResumenMeta,
): Promise<string | null> {
  // ── Hoja Programas ──────────────────────────────────────────────────────
  const programas = localidades.flatMap((loc) =>
    loc.programas.map((p) => ({
      Localidad: loc.localidad,
      Departamento: loc.departamento ?? '',
      Área: p.area === 'privada' ? 'Sec. Privada' : 'Vivienda',
      Programa: p.programa_label,
      Detalle: p.detalle ?? '',
      'Estado general': p.estado_general_label ?? '',
      'Sub-estado jurídico': p.subestados?.juridico ?? '',
      'Sub-estado técnico': p.subestados?.tecnico ?? '',
      'Sub-estado financiero': p.subestados?.financiero ?? '',
      'Checklist': p.area === 'privada'
        ? ''
        : !p.checklist_iniciado
          ? 'No iniciado'
          : p.checklist_faltan === 0
            ? 'Completo'
            : `${p.checklist_faltan} de ${p.checklist_total} faltan`,
      Monto: p.monto ?? '',
      Expediente: p.expediente ?? '',
      'Últ. comunicación': fecha10(p.ultima_comunicacion?.fecha),
      'Últ. comunicación (área)': p.ultima_comunicacion?.area ?? '',
      'Gestiones (Sec. Privada)': p.area === 'privada' ? p.privada_conteos?.total ?? '' : '',
    })),
  )

  // ── Hoja Checklists ─────────────────────────────────────────────────────
  const checklists = localidades.flatMap((loc) =>
    loc.programas
      .filter((p) => p.area === 'vivienda')
      .flatMap((p) => {
        const base = { Localidad: loc.localidad, Departamento: loc.departamento ?? '', Programa: p.programa_label }
        if (!p.checklist_iniciado) return [{ ...base, 'Ítem': '(checklist no iniciado)', Estado: 'no iniciado' }]
        if (p.checklist_faltan === 0) return [{ ...base, 'Ítem': '(sin faltantes)', Estado: 'completo' }]
        return p.checklist_faltantes.map((it) => ({ ...base, 'Ítem': it, Estado: 'falta' }))
      }),
  )

  // ── Hojas Gestiones + Movimientos (Sec. Privada) ────────────────────────
  let gestionesSheet: Record<string, unknown>[] = []
  let movimientosSheet: Record<string, unknown>[] = []
  let aviso: string | null = null

  const clavesPrivada = new Set(
    localidades
      .filter((loc) => loc.programas.some((p) => p.area === 'privada'))
      .map((loc) => keyOf(loc.departamento, loc.localidad)),
  )

  if (meta.incluirPrivada && clavesPrivada.size > 0) {
    const [todas, catMap] = await Promise.all([fetchTodasLasGestiones(), catCategoriasMap()])
    const enScope = todas
      .filter((g) => clavesPrivada.has(keyOf(g.departamento, g.localidad ?? '')))
      .sort(
        (a, b) =>
          (a.departamento ?? '').localeCompare(b.departamento ?? '', 'es') ||
          (a.localidad ?? '').localeCompare(b.localidad ?? '', 'es') ||
          fecha10(b.fecha_ingreso).localeCompare(fecha10(a.fecha_ingreso)),
      )

    const conEventos = enScope.slice(0, MAX_GESTIONES_EVENTOS)
    if (enScope.length > MAX_GESTIONES_EVENTOS) {
      aviso = `Se exportaron ${enScope.length} gestiones; el detalle de movimientos se limitó a las primeras ${MAX_GESTIONES_EVENTOS}. Aplicá más filtros para acotar.`
    }

    const eventosPorGestion = await mapConLimite(conEventos, CONCURRENCIA, (g) =>
      apiClient
        .get<EventoItem[]>(`/api/v1/privada/gestiones/${g.id_gestion}/eventos`)
        .then((r) => [...(r.data ?? [])].sort((a, b) => fecha10(a.fecha_evento).localeCompare(fecha10(b.fecha_evento))))
        .catch(() => [] as EventoItem[]),
    )
    const evMap = new Map(conEventos.map((g, i) => [g.id_gestion, eventosPorGestion[i]]))

    gestionesSheet = enScope.map((g) => {
      const evs = evMap.get(g.id_gestion) ?? []
      const ultimo = evs[evs.length - 1]
      return {
        Localidad: g.localidad ?? '',
        Departamento: g.departamento ?? '',
        'ID gestión': g.id_gestion,
        Estado: g.estado ?? '',
        Urgencia: g.urgencia ?? '',
        Categoría: catMap.get(g.categoria_general_id ?? '') ?? g.categoria_general_id ?? '',
        Detalle: g.detalle ?? '',
        'Fecha ingreso': fecha10(g.fecha_ingreso),
        'Días transcurridos': g.dias_transcurridos ?? '',
        'Nro expediente': g.nro_expediente ?? '',
        'Ok Gobernador': g.ok_gobernador ?? '',
        'Ok Ministro': g.ok_ministro ?? '',
        'Nº movimientos': evMap.has(g.id_gestion) ? evs.length : '(no traído)',
        'Último movimiento': ultimo ? `${fecha10(ultimo.fecha_evento)} · ${ultimo.tipo_evento ?? ''}` : '',
      }
    })

    movimientosSheet = conEventos.flatMap((g) =>
      (evMap.get(g.id_gestion) ?? []).map((e) => ({
        Localidad: g.localidad ?? '',
        Departamento: g.departamento ?? '',
        'ID gestión': g.id_gestion,
        Fecha: fecha10(e.fecha_evento),
        'Tipo de evento': e.tipo_evento ?? '',
        'Estado anterior': e.estado_anterior ?? '',
        'Estado nuevo': e.estado_nuevo ?? '',
        'Campo modificado': e.campo_modificado ?? '',
        'Valor anterior': e.valor_anterior ?? '',
        'Valor nuevo': e.valor_nuevo ?? '',
        Usuario: e.usuario ?? '',
        Rol: e.rol_usuario ?? '',
        Comentario: e.comentario ?? '',
      })),
    )
  }

  // ── Hoja Resumen ───────────────────────────────────────────────────────
  const resumen: Record<string, unknown>[] = [
    { Campo: 'Generado', Valor: new Date().toLocaleString('es-AR') },
    { Campo: 'Alcance', Valor: meta.alcance },
    { Campo: 'Filtros aplicados', Valor: meta.filtros || '(ninguno — todo el territorio)' },
    { Campo: 'Localidades', Valor: localidades.length },
    { Campo: 'Programas', Valor: programas.length },
    { Campo: 'Ítems de checklist', Valor: checklists.length },
    { Campo: 'Gestiones (Sec. Privada)', Valor: meta.incluirPrivada ? gestionesSheet.length : 'no incluidas (sin acceso)' },
    { Campo: 'Movimientos', Valor: meta.incluirPrivada ? movimientosSheet.length : '—' },
    ...(aviso ? [{ Campo: 'Aviso', Valor: aviso }] : []),
  ]

  exportSheetsToXlsx(
    [
      { name: 'Resumen', rows: resumen },
      { name: 'Programas', rows: programas },
      { name: 'Checklists', rows: checklists },
      { name: 'Gestiones', rows: gestionesSheet },
      { name: 'Movimientos', rows: movimientosSheet },
    ],
    `resumen_territorial_${hoy()}.xlsx`,
  )

  return aviso
}
