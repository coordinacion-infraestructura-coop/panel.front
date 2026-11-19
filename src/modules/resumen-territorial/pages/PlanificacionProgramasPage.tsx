// Planificación de programas por localidad (docs/files/spec-privada-planificacion-programas.md,
// ADR-036). Reemplaza la "Tabla general" del Resumen Territorial: todas las localidades del
// padrón, por programa, con columnas calculadas (otros servicios, sólo lectura) y columnas de
// trabajo editables con autosave por campo — sin botón "Guardar". Sólo Privada + Admin.

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import {
  puedeConfigurarPlanificacion,
  puedeEditarPlanificacion,
} from '../../../shared/utils/permisos'
import { exportToXlsx } from '../../../shared/utils/exportTable'
import {
  AREAS_PROGRAMA,
  codigoError,
  mensajeError,
  planificacionApi,
  type CambioFila,
  type Columna,
  type Estado,
  type FilaPlan,
  type Planilla,
  type Prioridad,
} from '../api/planificacion.api'
import { ConfiguracionModal } from '../components/planificacion/ConfiguracionModal'

// ── formato ────────────────────────────────────────────────────────────────────

const fmtNum = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-AR'))
const fmtFecha = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
function fmtMonto(n: number | null | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  return `$${n.toLocaleString('es-AR')}`
}
/** "150M" / "150 m" → 150.000.000; "1.500.000" / "1500000" → 1.500.000; "" → null. */
function parseMonto(txt: string): number | null | 'invalido' {
  const t = txt.trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!t) return null
  const m = /^([\d.,]+)(m|M)$/.exec(t)
  const base = (m ? m[1] : t).replace(/\./g, '').replace(',', '.')
  const n = Number(base)
  if (!Number.isFinite(n) || n < 0) return 'invalido'
  return m ? Math.round(n * 1_000_000) : n
}

const SEMAFORO_COLOR: Record<string, string> = {
  VERDE: '#22c55e', AMARILLO: '#eab308', ROJO: '#ef4444', NARANJA: '#f97316', AZUL: '#3b82f6', CELESTE: '#38bdf8',
}

type EstadoGuardado = { estado: 'guardando' | 'ok' | 'error' | 'conflicto'; msg?: string }

// ── página ─────────────────────────────────────────────────────────────────────

export function PlanificacionProgramasPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: portalUser } = usePortalUser()
  const puedeEditar = puedeEditarPlanificacion(portalUser)
  const puedeConfigurar = puedeConfigurarPlanificacion(portalUser)

  const programasQ = useQuery({ queryKey: ['planif', 'programas'], queryFn: () => planificacionApi.programas() })
  const programas = programasQ.data ?? []
  const programaId = Number(searchParams.get('programa')) || programas[0]?.id || null
  const programa = programas.find((p) => p.id === programaId) ?? null

  const setParam = (k: string, v: string) => {
    const sp = new URLSearchParams(searchParams)
    if (v) sp.set(k, v)
    else sp.delete(k)
    setSearchParams(sp, { replace: true })
  }

  const planillaQ = useQuery({
    queryKey: ['planif', 'planilla', programaId],
    queryFn: () => planificacionApi.planilla(programaId!),
    enabled: !!programaId,
  })
  const prioridadesQ = useQuery({
    queryKey: ['planif', 'catalogo', programaId, 'prioridades', 'todas'],
    queryFn: () => planificacionApi.catalogo<Prioridad>(programaId!, 'prioridades', true),
    enabled: !!programaId,
  })
  const estadosQ = useQuery({
    queryKey: ['planif', 'catalogo', programaId, 'estados', 'todas'],
    queryFn: () => planificacionApi.catalogo<Estado>(programaId!, 'estados', true),
    enabled: !!programaId,
  })
  const columnasQ = useQuery({
    queryKey: ['planif', 'catalogo', programaId, 'columnas', 'todas'],
    queryFn: () => planificacionApi.catalogo<Columna>(programaId!, 'columnas'),
    enabled: !!programaId,
  })

  const prioridades = useMemo(() => [...(prioridadesQ.data ?? [])].sort((a, b) => a.orden - b.orden), [prioridadesQ.data])
  const estados = useMemo(() => [...(estadosQ.data ?? [])].sort((a, b) => a.orden - b.orden), [estadosQ.data])
  const columnas = useMemo(
    () => [...(columnasQ.data ?? [])].filter((c) => c.visible).sort((a, b) => a.orden - b.orden),
    [columnasQ.data],
  )
  const prioById = useMemo(() => new Map(prioridades.map((p) => [p.id, p])), [prioridades])
  const estById = useMemo(() => new Map(estados.map((e) => [e.id, e])), [estados])

  // ── filtros ──
  const fDep = searchParams.get('departamento') ?? ''
  const [busqueda, setBusqueda] = useState('')
  const [fPrio, setFPrio] = useState<string[]>([])
  const [fEstado, setFEstado] = useState('')
  const [fPanel, setFPanel] = useState('')
  const [fVisita, setFVisita] = useState('')
  const [ocultarExcluidas, setOcultarExcluidas] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [config, setConfig] = useState(false)
  const [guardado, setGuardado] = useState<Record<string, EstadoGuardado>>({})

  useEffect(() => { setFPrio([]); setFEstado(''); setAbierta(null) }, [programaId])

  const filas = planillaQ.data?.items ?? []
  const deps = useMemo(() => [...new Set(filas.map((f) => f.departamento))].sort((a, b) => a.localeCompare(b, 'es')), [filas])
  // El "Ir a" del Resumen Territorial manda el depto con la grafía del snapshot.
  const fDepReal = deps.find((d) => d.localeCompare(fDep, 'es', { sensitivity: 'base' }) === 0) ?? ''

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    return filas.filter((f) => {
      if (fDepReal && f.departamento !== fDepReal) return false
      if (q && !f.localidad.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').includes(q)) return false
      if (fPrio.length && !fPrio.includes(f.prioridad_id == null ? 'sin' : String(f.prioridad_id))) return false
      if (fEstado && String(f.estado_id ?? 'sin') !== fEstado) return false
      if (fPanel && f.en_panel?.estado !== fPanel) return false
      if (fVisita === 'si' && f.visita_gobernador?.visitada !== true) return false
      if (fVisita === 'no' && f.visita_gobernador?.visitada !== false) return false
      if (ocultarExcluidas && f.prioridad_id != null && prioById.get(f.prioridad_id)?.excluye) return false
      return true
    })
  }, [filas, fDepReal, busqueda, fPrio, fEstado, fPanel, fVisita, ocultarExcluidas, prioById])

  // ── guardado por campo ──
  async function guardar(f: FilaPlan, cambio: Omit<CambioFila, 'updated_at'>) {
    if (!programaId) return
    setGuardado((g) => ({ ...g, [f.id_geo]: { estado: 'guardando' } }))
    try {
      const r = await planificacionApi.guardarFila(programaId, f.id_geo, { updated_at: f.updated_at, ...cambio })
      qc.setQueryData<Planilla>(['planif', 'planilla', programaId], (old) =>
        old ? { ...old, items: old.items.map((it) => (it.id_geo === f.id_geo ? { ...it, ...r } : it)) } : old,
      )
      setGuardado((g) => ({ ...g, [f.id_geo]: { estado: 'ok' } }))
      if (abierta === f.id_geo) qc.invalidateQueries({ queryKey: ['planif', 'historial', programaId, f.id_geo] })
    } catch (e) {
      const conflicto = codigoError(e) === 'CONFLICTO_EDICION'
      setGuardado((g) => ({ ...g, [f.id_geo]: { estado: conflicto ? 'conflicto' : 'error', msg: mensajeError(e) } }))
      if (conflicto) qc.invalidateQueries({ queryKey: ['planif', 'planilla', programaId] })
    }
  }

  // ── KPIs ──
  const kpis = useMemo(() => {
    const porPrio = new Map<string, number>()
    for (const f of visibles) {
      const k = f.prioridad_id == null ? 'sin' : String(f.prioridad_id)
      porPrio.set(k, (porPrio.get(k) ?? 0) + 1)
    }
    const montos = columnas
      .filter((c) => c.tipo === 'monto')
      .map((c) => ({ col: c, total: visibles.reduce((s, f) => s + (Number(f.valores[c.clave]) || 0), 0) }))
    return {
      porPrio,
      enPanel: visibles.filter((f) => f.en_panel?.estado === 'si').length,
      sinPanel: visibles.filter((f) => f.en_panel?.estado === 'no').length,
      convenio: visibles.filter((f) => f.convenio?.firmado).length,
      montos,
    }
  }, [visibles, columnas])

  // ── export ──
  function exportar() {
    if (!programa) return
    const rows = visibles.map((f) => {
      const pr = f.prioridad_id != null ? prioById.get(f.prioridad_id) : undefined
      const es = f.estado_id != null ? estById.get(f.estado_id) : undefined
      const base: Record<string, unknown> = {
        Departamento: f.departamento,
        Localidad: f.localidad,
        Tipo: f.tipo_localidad ?? '',
        Habitantes: f.habitantes ?? '',
        'Coparticipación anual': f.coparticipacion_anual?.monto ?? '',
        'Visita del gobernador': f.visita_gobernador == null ? '' : f.visita_gobernador.visitada ? `Sí ${fmtFecha(f.visita_gobernador.fecha_ultima)}`.trim() : 'No',
        Semáforo: f.semaforo ?? '',
      }
      if (programa.fuente) {
        base['¿Está en el panel?'] = f.en_panel ? { si: 'Sí', no: 'No', sin_dato: 'Sin dato' }[f.en_panel.estado] : ''
        base['Estado en el panel'] = (f.en_panel?.lineas ?? []).map((l) => l.estado_general?.label).filter(Boolean).join(' · ')
        base['¿Convenio?'] = f.convenio ? (f.convenio.firmado ? `Sí ${fmtFecha(f.convenio.fecha)}`.trim() : 'No') : ''
      }
      base.Prioridad = pr ? `${pr.codigo} — ${pr.nombre}` : ''
      base.Estado = es?.nombre ?? ''
      const ok = f.ok_gobernador_panel ?? f.ok_gobernador
      base['OK gobernador'] = ok == null ? '' : ok ? 'Sí' : 'No'
      for (const c of columnas) {
        const v = f.valores[c.clave]
        base[c.nombre] = v == null ? '' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : (v as string | number)
      }
      return base
    })
    const fecha = new Date().toISOString().slice(0, 10)
    exportToXlsx(rows, programa.nombre.slice(0, 31), `planificacion_${programa.nombre.replace(/\W+/g, '_')}_${fecha}.xlsx`)
  }

  const fuentes = planillaQ.data?.fuentes ?? {}
  const colsFijas = 9 + (programa?.fuente ? 2 : 0)

  return (
    <div>
      <Link
        to={`/resumen-territorial${fDep ? `?departamento=${encodeURIComponent(fDep)}` : ''}`}
        className="text-sm text-gov-cyan hover:text-gov-navy font-semibold inline-block mb-2"
      >
        ← Volver a Resumen Territorial
      </Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Planificación de programas</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Todas las localidades por programa: qué ya está en marcha y dónde todavía no hay nada — Sec. Privada
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={programaId ?? ''}
            onChange={(e) => setParam('programa', e.target.value)}
            className="text-sm bg-white border border-slate-300 rounded px-2 py-1.5 min-w-[220px]"
          >
            {programas.length === 0 && <option value="">Sin programas</option>}
            {AREAS_PROGRAMA.map((a) => {
              const deArea = programas.filter((p) => p.area === a.id)
              return deArea.length ? (
                <optgroup key={a.id} label={a.label}>
                  {deArea.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </optgroup>
              ) : null
            })}
          </select>
          {puedeConfigurar && (
            <button onClick={() => setConfig(true)} className="text-sm border border-slate-300 bg-white rounded px-3 py-1.5 hover:border-gov-cyan">
              ⚙ Configuración
            </button>
          )}
          <button onClick={exportar} disabled={!visibles.length} className="text-sm bg-gov-cyan text-white rounded px-3 py-1.5 disabled:opacity-40">
            ⤓ Exportar Excel
          </button>
        </div>
      </div>

      {programasQ.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">{mensajeError(programasQ.error, 'No se pudo cargar la planificación.')}</div>
      )}
      {programasQ.isSuccess && programas.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-10 text-center text-sm text-gray-500">
          Todavía no hay programas cargados.{' '}
          {puedeConfigurar ? (
            <button className="text-gov-blue font-semibold" onClick={() => setConfig(true)}>Crear el primero</button>
          ) : 'Pedile a un Supervisor que cree el primero.'}
        </div>
      )}

      {programa && (
        <div className="space-y-3">
          {(fuentes.panel === 'sin_dato' || fuentes.datos_externos === 'sin_dato') && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2">
              {fuentes.panel === 'sin_dato' && 'No se pudo consultar el panel del programa: «¿Está en el panel?» y «¿Convenio?» quedan sin dato. '}
              {fuentes.datos_externos === 'sin_dato' && 'No se pudieron consultar los datos externos: visita y coparticipación quedan sin dato. '}
              La planilla se puede seguir editando.
            </div>
          )}
          {fuentes.panel_sin_id_geo && (
            <div className="text-xs text-gray-500">
              {fuentes.panel_sin_id_geo} fila(s) del panel del programa no tienen localidad oficial y no se pueden ubicar en esta planilla.
            </div>
          )}

          {/* KPIs */}
          <div className="flex flex-wrap gap-2">
            {prioridades.filter((p) => !p.eliminado).map((p) => (
              <button
                key={p.id}
                onClick={() => setFPrio((v) => (v.includes(String(p.id)) ? v.filter((x) => x !== String(p.id)) : [...v, String(p.id)]))}
                className={`rounded-lg px-3 py-2 text-left border-2 ${fPrio.includes(String(p.id)) ? 'border-gov-navy' : 'border-transparent'}`}
                style={{ background: p.color_bg ?? '#f1f5f9', color: p.color_texto ?? '#172c3f' }}
                title="Filtrar por esta prioridad"
              >
                <div className="text-lg font-bold leading-none">{kpis.porPrio.get(String(p.id)) ?? 0}</div>
                <div className="text-[11px] font-semibold">{p.codigo} · {p.nombre}</div>
              </button>
            ))}
            <div className="rounded-lg px-3 py-2 bg-slate-100 text-slate-600">
              <div className="text-lg font-bold leading-none">{kpis.porPrio.get('sin') ?? 0}</div>
              <div className="text-[11px] font-semibold">Sin clasificar</div>
            </div>
            {programa.fuente && (
              <>
                <div className="rounded-lg px-3 py-2 bg-white border border-slate-200">
                  <div className="text-lg font-bold leading-none text-gov-navy">{kpis.enPanel} / {kpis.sinPanel}</div>
                  <div className="text-[11px] font-semibold text-gray-500">En el panel / sin nada</div>
                </div>
                {programa.fuente === 'cordoba_hogar' && (
                  <div className="rounded-lg px-3 py-2 bg-white border border-slate-200">
                    <div className="text-lg font-bold leading-none text-gov-navy">{kpis.convenio}</div>
                    <div className="text-[11px] font-semibold text-gray-500">Con convenio firmado</div>
                  </div>
                )}
              </>
            )}
            {kpis.montos.map(({ col, total }) => (
              <div key={col.id} className="rounded-lg px-3 py-2 bg-white border border-slate-200">
                <div className="text-lg font-bold leading-none text-gov-navy">{fmtMonto(total)}</div>
                <div className="text-[11px] font-semibold text-gray-500">{col.nombre}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-lg p-3">
            <select value={fDepReal} onChange={(e) => setParam('departamento', e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
              <option value="">Toda la provincia</option>
              {deps.map((d) => <option key={d}>{d}</option>)}
            </select>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar localidad…" className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5" />
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
              <option value="">Estado: cualquiera</option>
              <option value="sin">Sin estado</option>
              {estados.filter((e) => !e.eliminado).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            {programa.fuente && (
              <select value={fPanel} onChange={(e) => setFPanel(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">¿En el panel?: cualquiera</option>
                <option value="si">Ya está en el panel</option>
                <option value="no">Todavía no tiene nada</option>
              </select>
            )}
            <select value={fVisita} onChange={(e) => setFVisita(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
              <option value="">Visita del gobernador: cualquiera</option>
              <option value="si">Visitada</option>
              <option value="no">No visitada</option>
            </select>
            <label className="text-xs flex items-center gap-1 text-gray-600">
              <input type="checkbox" checked={ocultarExcluidas} onChange={(e) => setOcultarExcluidas(e.target.checked)} />
              Ocultar desestimadas
            </label>
            {(fPrio.length > 0 || fEstado || fPanel || fVisita || busqueda || fDepReal) && (
              <button
                className="text-xs text-gov-blue"
                onClick={() => { setFPrio([]); setFEstado(''); setFPanel(''); setFVisita(''); setBusqueda(''); setParam('departamento', '') }}
              >
                ✕ Limpiar
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{visibles.length} de {filas.length} localidades</span>
          </div>

          {/* Planilla */}
          {planillaQ.isLoading ? (
            <div className="text-sm text-gray-400 py-10 text-center">Cargando…</div>
          ) : planillaQ.isError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">{mensajeError(planillaQ.error, 'No se pudo cargar la planilla.')}</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-auto max-h-[75vh]">
              <table className="text-xs border-collapse min-w-full">
                <thead className="sticky top-0 z-20 bg-slate-50">
                  <tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left">
                    <th className="px-2 py-2 sticky left-0 z-30 bg-slate-50 min-w-[190px]">Localidad</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2 text-right">Habitantes</th>
                    <th className="px-2 py-2 text-right" title="Concepto coparticipación, últimos 12 meses publicados">Copart. anual</th>
                    <th className="px-2 py-2" title="Planilla de visitas del gobernador (Gobierno)">Visita gob.</th>
                    <th className="px-2 py-2" title="Semáforo político de la localidad (solo lectura)">Semáforo</th>
                    {programa.fuente && <th className="px-2 py-2">¿Está en el panel?</th>}
                    {programa.fuente && <th className="px-2 py-2">¿Convenio?</th>}
                    <th className="px-2 py-2">Prioridad</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">OK gob.</th>
                    {columnas.map((c) => <th key={c.id} className="px-2 py-2 min-w-[120px]">{c.nombre}</th>)}
                    <th className="px-2 py-2" title="Historial de cambios">🕘</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => {
                    const est = f.estado_id != null ? estById.get(f.estado_id) : undefined
                    const pri = f.prioridad_id != null ? prioById.get(f.prioridad_id) : undefined
                    // La fila toma el color de su estado; si no tiene, el de su prioridad (spec §4.3).
                    const bg = est?.color_bg ?? pri?.color_bg ?? undefined
                    const fg = est?.color_bg ? est.color_texto : pri?.color_texto
                    const g = guardado[f.id_geo]
                    return (
                      <Fragment key={f.id_geo}>
                        <tr className="border-t border-slate-200 align-top" style={{ background: bg, color: fg ?? undefined }}>
                          <td className="px-2 py-1.5 sticky left-0 z-10" style={{ background: bg ?? '#fff' }}>
                            <div className="font-semibold text-[13px]">{f.localidad}</div>
                            <div className="text-[10px] uppercase opacity-70">{f.departamento}</div>
                            {g && g.estado !== 'ok' && (
                              <div className={`text-[10px] ${g.estado === 'guardando' ? 'opacity-60' : 'text-red-700 font-semibold'}`}>
                                {g.estado === 'guardando' ? 'guardando…' : g.estado === 'conflicto' ? 'Otra persona la cambió: se recargó' : g.msg}
                              </div>
                            )}
                            {g?.estado === 'ok' && <div className="text-[10px] opacity-60">✓ guardado</div>}
                          </td>
                          <td className="px-2 py-1.5">{f.tipo_localidad ? f.tipo_localidad.slice(0, 1).toUpperCase() : '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(f.habitantes)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap"
                            title={f.coparticipacion_anual ? `${fmtFecha(f.coparticipacion_anual.desde)}–${fmtFecha(f.coparticipacion_anual.hasta)} · ${f.coparticipacion_anual.meses} mes(es)` : undefined}>
                            {f.coparticipacion_anual ? (
                              <>
                                {fmtMonto(f.coparticipacion_anual.monto)}
                                {f.coparticipacion_anual.meses < (f.coparticipacion_anual.meses_ventana ?? 12) && <span className="text-[9px] opacity-60"> parcial</span>}
                              </>
                            ) : '—'}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {f.visita_gobernador == null ? '—' : f.visita_gobernador.visitada ? `Sí ${fmtFecha(f.visita_gobernador.fecha_ultima)}` : 'No'}
                          </td>
                          <td className="px-2 py-1.5">
                            {f.semaforo ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ background: SEMAFORO_COLOR[f.semaforo.toUpperCase()] ?? '#94a3b8' }} />
                                {f.semaforo}
                              </span>
                            ) : '—'}
                          </td>
                          {programa.fuente && <td className="px-2 py-1.5"><EnPanel f={f} /></td>}
                          {programa.fuente && (
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {f.convenio ? (f.convenio.firmado ? `Sí ${fmtFecha(f.convenio.fecha)}` : 'No') : '—'}
                            </td>
                          )}
                          <td className="px-2 py-1.5">
                            <CatalogoSelect items={prioridades} valor={f.prioridad_id} etiqueta={(p) => `${(p as Prioridad).codigo} · ${p.nombre}`}
                              disabled={!puedeEditar} onChange={(v) => guardar(f, { prioridad_id: v })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <CatalogoSelect items={estados} valor={f.estado_id} etiqueta={(e) => e.nombre}
                              disabled={!puedeEditar} onChange={(v) => guardar(f, { estado_id: v })} />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {f.ok_gobernador_panel != null ? (
                              <span title="Dato del panel del programa">{f.ok_gobernador_panel ? 'Sí' : 'No'} <span className="text-[9px] opacity-60">del panel</span></span>
                            ) : (
                              <SiNoSelect valor={f.ok_gobernador} disabled={!puedeEditar} onChange={(v) => guardar(f, { ok_gobernador: v })} />
                            )}
                          </td>
                          {columnas.map((c) => (
                            <td key={c.id} className="px-2 py-1.5">
                              <CeldaValor col={c} valor={f.valores[c.clave]} disabled={!puedeEditar}
                                onChange={(v) => guardar(f, { valores: { [c.clave]: v } })} />
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <button onClick={() => setAbierta((a) => (a === f.id_geo ? null : f.id_geo))}
                              className="text-[11px] underline-offset-2 hover:underline whitespace-nowrap" title="Historial de cambios">
                              🕘 {f.cambios}
                            </button>
                          </td>
                        </tr>
                        {abierta === f.id_geo && (
                          <tr>
                            <td colSpan={colsFijas + columnas.length + 1} className="bg-slate-50 px-4 py-3">
                              <Historial programaId={programa.id} idGeo={f.id_geo} columnas={columnasQ.data ?? []} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {visibles.length === 0 && (
                    <tr><td colSpan={colsFijas + columnas.length + 1} className="px-4 py-10 text-center text-gray-400">Sin localidades con los filtros actuales.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            Los cambios se guardan solos al elegir o al salir del campo. «¿Está en el panel?», «¿Convenio?», visita,
            coparticipación y semáforo se leen de otros sistemas y no se editan acá.
          </p>
        </div>
      )}

      {config && (
        <ConfiguracionModal
          programa={programa}
          esAdmin={portalUser?.rol === 'Admin'}
          onClose={() => setConfig(false)}
          onProgramaCreado={(id) => setParam('programa', String(id))}
        />
      )}
    </div>
  )
}

// ── celdas ─────────────────────────────────────────────────────────────────────

function EnPanel({ f }: { f: FilaPlan }) {
  if (!f.en_panel || f.en_panel.estado === 'sin_dato') return <span className="opacity-60">sin dato</span>
  if (f.en_panel.estado === 'no') return <span className="font-semibold">No</span>
  return (
    <div className="flex flex-col gap-0.5">
      {f.en_panel.lineas.map((l, i) => (
        <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap">
          Sí
          {l.estado_general && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: l.estado_general.bg ?? '#e5e7eb', color: l.estado_general.text_color ?? '#374151' }}>
              {l.estado_general.label}
            </span>
          )}
        </span>
      ))}
      {f.en_panel.lineas.length > 1 && <span className="text-[10px] opacity-70">{f.en_panel.lineas.length} filas</span>}
    </div>
  )
}

const celda = 'text-xs border border-slate-300/70 rounded px-1.5 py-1 bg-white/80 text-gov-navy disabled:bg-transparent disabled:border-transparent disabled:text-inherit'

function CatalogoSelect<T extends Estado>({ items, valor, etiqueta, disabled, onChange }: {
  items: T[]; valor: number | null; etiqueta: (i: T) => string; disabled: boolean; onChange: (v: number | null) => void
}) {
  const actual = items.find((i) => i.id === valor)
  return (
    <select className={`${celda} max-w-[170px]`} value={valor ?? ''} disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">—</option>
      {items.filter((i) => !i.eliminado || i.id === valor).map((i) => (
        <option key={i.id} value={i.id}>{etiqueta(i)}{i.eliminado ? ' (eliminado)' : ''}</option>
      ))}
      {valor != null && !actual && <option value={valor}>(eliminado)</option>}
    </select>
  )
}

function SiNoSelect({ valor, disabled, onChange }: { valor: boolean | null | undefined; disabled: boolean; onChange: (v: boolean | null) => void }) {
  return (
    <select className={celda} disabled={disabled} value={valor == null ? '' : valor ? 'si' : 'no'}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'si')}>
      <option value="">—</option>
      <option value="si">Sí</option>
      <option value="no">No</option>
    </select>
  )
}

function CeldaValor({ col, valor, disabled, onChange }: { col: Columna; valor: unknown; disabled: boolean; onChange: (v: unknown) => void }) {
  const [error, setError] = useState(false)
  if (col.tipo === 'si_no') return <SiNoSelect valor={valor as boolean | null} disabled={disabled} onChange={onChange} />
  if (col.tipo === 'lista') {
    return (
      <select className={celda} disabled={disabled} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {(col.opciones ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    )
  }
  if (col.tipo === 'texto_largo') {
    return (
      <textarea className={`${celda} w-56 min-h-[2rem]`} rows={1} disabled={disabled} defaultValue={(valor as string) ?? ''}
        key={String(valor ?? '')}
        onBlur={(e) => e.target.value !== ((valor as string) ?? '') && onChange(e.target.value || null)} />
    )
  }
  if (col.tipo === 'fecha') {
    return (
      <input type="date" className={celda} disabled={disabled} defaultValue={(valor as string) ?? ''} key={String(valor ?? '')}
        onBlur={(e) => e.target.value !== ((valor as string) ?? '') && onChange(e.target.value || null)} />
    )
  }
  if (col.tipo === 'monto' || col.tipo === 'numero') {
    const mostrado = valor == null ? '' : col.tipo === 'monto' ? Number(valor).toLocaleString('es-AR') : String(valor)
    return (
      <input className={`${celda} w-28 text-right ${error ? 'border-red-500' : ''}`} disabled={disabled} defaultValue={mostrado} key={mostrado}
        placeholder={col.tipo === 'monto' ? 'ej. 150M' : ''}
        title={col.tipo === 'monto' && valor != null ? fmtMonto(Number(valor)) : undefined}
        onBlur={(e) => {
          if (e.target.value === mostrado) return
          const n = col.tipo === 'monto' ? parseMonto(e.target.value) : e.target.value.trim() === '' ? null : Number(e.target.value.replace(',', '.'))
          if (n === 'invalido' || (typeof n === 'number' && !Number.isFinite(n))) { setError(true); return }
          setError(false)
          onChange(n)
        }} />
    )
  }
  return (
    <input className={`${celda} w-40`} disabled={disabled} defaultValue={(valor as string) ?? ''} key={String(valor ?? '')}
      onBlur={(e) => e.target.value !== ((valor as string) ?? '') && onChange(e.target.value || null)} />
  )
}

function Historial({ programaId, idGeo, columnas }: { programaId: number; idGeo: string; columnas: Columna[] }) {
  const q = useQuery({ queryKey: ['planif', 'historial', programaId, idGeo], queryFn: () => planificacionApi.historial(programaId, idGeo) })
  const nombre = (campo: string) =>
    ({ prioridad: 'Prioridad', estado: 'Estado', ok_gobernador: 'OK gobernador' } as Record<string, string>)[campo] ??
    columnas.find((c) => c.clave === campo)?.nombre ?? campo
  if (q.isLoading) return <span className="text-xs text-gray-400">Cargando historial…</span>
  if (!q.data?.length) return <span className="text-xs text-gray-400">Sin cambios todavía.</span>
  return (
    <table className="text-xs">
      <tbody>
        {q.data.map((h) => (
          <tr key={h.id}>
            <td className="pr-3 text-gray-500 whitespace-nowrap">{new Date(h.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td className="pr-3 text-gray-500">{h.usuario}</td>
            <td className="pr-3 font-semibold text-gov-navy">{nombre(h.campo)}</td>
            <td className="text-gray-700">{h.valor_anterior ?? '—'} → <strong>{h.valor_nuevo ?? '—'}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

