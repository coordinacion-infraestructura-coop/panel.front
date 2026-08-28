// Federación de la Secretaría Privada en el Resumen Territorial (plan B — spec §3.3).
// El backend no puede llamar a svc-privada server-to-server (rechaza el token de la SA),
// así que el frontend trae las gestiones con el token del usuario y arma una línea
// roll-up `area:"privada"` por localidad, con la misma forma `ResumenPrograma`.

import apiClient from '../../../shared/api/client'
import type { ResumenPrograma } from '../types/resumenTerritorial.types'

interface PrivadaGestion {
  id_gestion: string
  estado?: string
  estado_nombre?: string
  departamento?: string
  localidad?: string
  fecha_estado?: string
  fecha_ingreso?: string
}

const CERRADOS = new Set(['FINALIZADA', 'ARCHIVADO'])
const PAGE = 200

const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

async function fetchTodasLasGestiones(): Promise<PrivadaGestion[]> {
  const first = await apiClient
    .get<{ items: PrivadaGestion[]; total: number }>('/api/v1/privada/gestiones/', {
      params: { limit: PAGE, offset: 0 },
    })
    .then((r) => r.data)
  const items = [...(first.items ?? [])]
  const total = first.total ?? items.length
  const restantes: Promise<PrivadaGestion[]>[] = []
  for (let offset = PAGE; offset < total; offset += PAGE) {
    restantes.push(
      apiClient
        .get<{ items: PrivadaGestion[] }>('/api/v1/privada/gestiones/', {
          params: { limit: PAGE, offset },
        })
        .then((r) => r.data.items ?? []),
    )
  }
  for (const chunk of await Promise.all(restantes)) items.push(...chunk)
  return items
}

function estadoBadge(porEstado: Record<string, number>) {
  const total = Object.values(porEstado).reduce((a, b) => a + b, 0)
  const cerradas = Object.entries(porEstado)
    .filter(([k]) => CERRADOS.has(k.toUpperCase()))
    .reduce((a, [, n]) => a + n, 0)
  const activas = total - cerradas
  if (total === 0) return { label: 'Sin estado', bg: '#e5e7eb', fg: '#374151' }
  if (activas === 0) return { label: 'Finalizadas', bg: '#dcf5e3', fg: '#15803d' }
  if (cerradas === 0) return { label: 'En curso', bg: '#dceffb', fg: '#036aa1' }
  return { label: 'Mixto', bg: '#fdf0d5', fg: '#b45309' }
}

function detalle(porEstado: Record<string, number>): string {
  const total = Object.values(porEstado).reduce((a, b) => a + b, 0)
  const cerradas = Object.entries(porEstado)
    .filter(([k]) => CERRADOS.has(k.toUpperCase()))
    .reduce((a, [, n]) => a + n, 0)
  const activas = total - cerradas
  const partes: string[] = []
  if (activas) partes.push(`${activas} en curso`)
  if (cerradas) partes.push(`${cerradas} finalizada${cerradas !== 1 ? 's' : ''}`)
  const g = total === 1 ? '1 gestión' : `${total} gestiones`
  return partes.length ? `${g} · ${partes.join(', ')}` : g
}

export interface PrivadaLocalidad {
  /** norm(departamento) + '|' + norm(localidad) — misma clave que usa la página para mergear */
  key: string
  departamento: string | null
  localidad: string
  programa: ResumenPrograma
}

export async function fetchPrivadaPorLocalidad(): Promise<PrivadaLocalidad[]> {
  const gestiones = await fetchTodasLasGestiones()
  const grupos = new Map<
    string,
    { dep: string | null; loc: string; porEstado: Record<string, number>; ultima: string | null }
  >()

  for (const g of gestiones) {
    const loc = (g.localidad ?? '').trim()
    if (!loc) continue
    const dep = (g.departamento ?? '').trim() || null
    const key = `${norm(dep ?? '')}|${norm(loc)}`
    if (!grupos.has(key)) grupos.set(key, { dep, loc, porEstado: {}, ultima: null })
    const grp = grupos.get(key)!
    const est = (g.estado_nombre || g.estado || 'Sin estado').toUpperCase()
    grp.porEstado[est] = (grp.porEstado[est] ?? 0) + 1
    const f = g.fecha_estado || g.fecha_ingreso || null
    if (f && (!grp.ultima || f > grp.ultima)) grp.ultima = f
  }

  return [...grupos.entries()].map(([key, grp]) => {
    const total = Object.values(grp.porEstado).reduce((a, b) => a + b, 0)
    const meta = estadoBadge(grp.porEstado)
    const programa: ResumenPrograma = {
      area: 'privada',
      programa: 'gestiones',
      programa_label: 'Gestiones — Sec. Privada',
      entidad_id: null,
      detalle: detalle(grp.porEstado),
      estado_general_id: null,
      estado_general_label: meta.label,
      estado_general_bg: meta.bg,
      estado_general_text_color: meta.fg,
      subestados: null,
      checklist_total: 0,
      checklist_faltan: 0,
      checklist_iniciado: false,
      checklist_faltantes: [],
      ultima_comunicacion: grp.ultima
        ? { fecha: grp.ultima.slice(0, 10), texto: null, area: 'privada', autor: null }
        : null,
      monto: null,
      expediente: null,
      privada_conteos: { por_estado: grp.porEstado, total },
    }
    return { key, departamento: grp.dep, localidad: grp.loc, programa }
  })
}
