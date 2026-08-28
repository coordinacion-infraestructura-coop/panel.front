import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resumenTerritorialApi } from '../api/resumenTerritorial.api'
import type {
  ResumenLocalidad,
  ResumenPrograma,
  ResumenSnapshot,
} from '../types/resumenTerritorial.types'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'
import { exportToXlsx } from '../../../shared/utils/exportTable'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'

// ── Helpers ──────────────────────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? `${iso}T12:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function fmtHaceTiempo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

function fmtMonto(n: number | null): string {
  if (n === null || n === undefined) return ''
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'No tenés permisos para actualizar el resumen.'
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: unknown }).message)
  }
  return fallback
}

const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const AREA_LABEL: Record<string, string> = { vivienda: 'Vivienda', privada: 'Sec. Privada' }

// ── Badges ───────────────────────────────────────────────────────────────────────

function EstadoBadge({ prog }: { prog: ResumenPrograma }) {
  if (!prog.estado_general_label) {
    return <span className="text-gray-400 text-xs">—</span>
  }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        background: prog.estado_general_bg ?? '#e5e7eb',
        color: prog.estado_general_text_color ?? '#374151',
      }}
    >
      {prog.estado_general_label}
    </span>
  )
}

function ChecklistPill({ prog }: { prog: ResumenPrograma }) {
  if (prog.area === 'privada') return <span className="text-gray-300 text-xs">—</span>
  if (!prog.checklist_iniciado) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
        No iniciado
      </span>
    )
  }
  if (prog.checklist_faltan === 0) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700">
        Completo
      </span>
    )
  }
  const alto = prog.checklist_faltan > 3
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
        alto ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {prog.checklist_faltan} de {prog.checklist_total} faltan
    </span>
  )
}

// ── Ficha de localidad (drawer) ─────────────────────────────────────────────────

function DetailDrawer({
  localidad,
  onClose,
}: {
  localidad: ResumenLocalidad | null
  onClose: () => void
}) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
          localidad ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform ${
          localidad ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!localidad}
      >
        {localidad && (
          <>
            <header className="bg-gov-navy text-white px-5 py-4 relative">
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute top-3 right-3 bg-white/15 hover:bg-white/25 w-7 h-7 rounded text-sm"
              >
                ✕
              </button>
              <p className="text-[10px] uppercase tracking-widest text-gov-cyan">
                Ficha de localidad
              </p>
              <h2 className="text-lg font-semibold mt-0.5">{localidad.localidad}</h2>
              <p className="text-xs text-white/60 uppercase tracking-wide mt-0.5">
                {localidad.departamento ?? 'Sin departamento'}
              </p>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {localidad.programas.map((p, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gov-navy">{p.programa_label}</h3>
                    <EstadoBadge prog={p} />
                  </div>
                  {p.detalle && <p className="text-xs text-gray-500 mt-1">{p.detalle}</p>}

                  {p.area === 'vivienda' && p.subestados && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(['juridico', 'tecnico', 'financiero'] as const).map((k) => (
                        <span
                          key={k}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600"
                        >
                          {k === 'juridico' ? 'Jurídico' : k === 'tecnico' ? 'Técnico' : 'Financiero'}:{' '}
                          <b className="text-gov-navy">{p.subestados?.[k] ?? '—'}</b>
                        </span>
                      ))}
                    </div>
                  )}

                  {p.area === 'vivienda' && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">
                        Checklist técnico
                      </p>
                      {!p.checklist_iniciado ? (
                        <p className="text-xs text-slate-500 italic">
                          No iniciado — {p.checklist_total} ítems pendientes.
                        </p>
                      ) : p.checklist_faltan === 0 ? (
                        <p className="text-xs text-green-700">
                          Completo ({p.checklist_total}/{p.checklist_total}).
                        </p>
                      ) : (
                        <ul className="text-xs text-slate-600 space-y-1">
                          {p.checklist_faltantes.map((f, j) => (
                            <li key={j} className="flex gap-1.5">
                              <span className="text-red-500">○</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {p.area === 'privada' && p.privada_conteos && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">
                        Gestiones por estado
                      </p>
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {Object.entries(p.privada_conteos.por_estado).map(([e, n]) => (
                          <li key={e} className="flex justify-between">
                            <span>{e}</span>
                            <b className="text-gov-navy">{n}</b>
                          </li>
                        ))}
                      </ul>
                      <Link
                        to={`/privada/gestiones?departamento=${encodeURIComponent(
                          localidad.departamento ?? '',
                        )}&localidad=${encodeURIComponent(localidad.localidad)}`}
                        className="text-xs text-gov-cyan hover:text-gov-navy mt-2 inline-block"
                      >
                        Ver en el panel de Privada →
                      </Link>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                      Última comunicación
                    </p>
                    {p.ultima_comunicacion ? (
                      <p className="text-xs text-slate-600">
                        {p.ultima_comunicacion.texto ?? (
                          <span className="italic text-slate-400">
                            (comunicación de otra área — sin acceso al detalle)
                          </span>
                        )}
                        <span className="block text-[10px] text-gray-400 mt-0.5">
                          {fmtDate(p.ultima_comunicacion.fecha)}
                          {p.ultima_comunicacion.area ? ` · ${p.ultima_comunicacion.area}` : ''}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Sin comunicaciones registradas.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────────

type Unidad = 'localidad' | 'departamento'

export function ResumenTerritorialPage() {
  const queryClient = useQueryClient()
  const { data: portalUser } = usePortalUser()
  const canActualizar = ['Admin', 'Supervisor', 'Operador', 'Autoridad'].includes(
    portalUser?.rol ?? '',
  )

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['resumen-territorial'],
    queryFn: resumenTerritorialApi.getResumen,
    staleTime: Infinity,
  })

  const [error, setError] = useState<string | null>(null)
  const actualizarMut = useMutation({
    mutationFn: resumenTerritorialApi.actualizarResumen,
    onSuccess: (data: ResumenSnapshot) => {
      queryClient.setQueryData(['resumen-territorial'], data)
      setError(null)
    },
    onError: (err) => setError(extractErrorMessage(err, 'No se pudo actualizar el resumen.')),
  })

  const [unidad, setUnidad] = useState<Unidad>('localidad')
  const [q, setQ] = useState('')
  const [fDep, setFDep] = useState('')
  const [fArea, setFArea] = useState('')
  const [fProg, setFProg] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fChecklist, setFChecklist] = useState('')
  const [detalleLoc, setDetalleLoc] = useState<ResumenLocalidad | null>(null)

  const payload = snapshot?.payload

  const opciones = useMemo(() => {
    const deps = new Set<string>()
    const progs = new Map<string, string>()
    const estados = new Set<string>()
    const areas = new Set<string>()
    for (const loc of payload?.localidades ?? []) {
      if (loc.departamento) deps.add(loc.departamento)
      for (const p of loc.programas) {
        progs.set(p.programa, p.programa_label)
        areas.add(p.area)
        if (p.estado_general_label) estados.add(p.estado_general_label)
      }
    }
    return {
      deps: [...deps].sort((a, b) => a.localeCompare(b, 'es')),
      progs: [...progs.entries()],
      estados: [...estados].sort((a, b) => a.localeCompare(b, 'es')),
      areas: [...areas],
    }
  }, [payload])

  const localidadesFiltradas = useMemo<ResumenLocalidad[]>(() => {
    const nq = norm(q)
    return (payload?.localidades ?? [])
      .map((loc) => {
        const progs = loc.programas.filter((p) => {
          if (fArea && p.area !== fArea) return false
          if (fProg && p.programa !== fProg) return false
          if (fEstado && p.estado_general_label !== fEstado) return false
          if (fChecklist === 'con_faltantes' && !(p.area === 'vivienda' && p.checklist_iniciado && p.checklist_faltan > 0))
            return false
          if (fChecklist === 'completo' && !(p.area === 'vivienda' && p.checklist_iniciado && p.checklist_faltan === 0))
            return false
          if (fChecklist === 'no_iniciado' && !(p.area === 'vivienda' && !p.checklist_iniciado)) return false
          return true
        })
        return { ...loc, programas: progs }
      })
      .filter((loc) => {
        if (fDep && loc.departamento !== fDep) return false
        if (nq && !norm(`${loc.localidad} ${loc.departamento ?? ''}`).includes(nq)) return false
        return loc.programas.length > 0
      })
  }, [payload, q, fDep, fArea, fProg, fEstado, fChecklist])

  const kpis = useMemo<Kpi[]>(() => {
    const progs = localidadesFiltradas.flatMap((l) => l.programas)
    const conFaltantes = progs.filter(
      (p) => p.area === 'vivienda' && p.checklist_iniciado && p.checklist_faltan > 0,
    ).length
    const recientes = progs.filter((p) => {
      if (!p.ultima_comunicacion) return false
      const d = new Date(`${p.ultima_comunicacion.fecha}T12:00`)
      return (Date.now() - d.getTime()) / 86400000 <= 30
    }).length
    const deps = new Set(localidadesFiltradas.map((l) => l.departamento).filter(Boolean)).size
    return [
      { value: localidadesFiltradas.length, label: 'Localidades' },
      { value: progs.length, label: 'Programas activos', accent: 'cyan' },
      { value: conFaltantes, label: 'Con ítems faltantes', accent: 'red' },
      { value: recientes, label: 'Comunicaciones · 30 días', accent: 'green' },
      { value: deps, label: 'Departamentos', accent: 'navy' },
    ]
  }, [localidadesFiltradas])

  // Rollup por departamento (client-side, sobre el mismo payload filtrado)
  const porDepartamento = useMemo(() => {
    const map = new Map<
      string,
      { departamento: string; localidades: number; porPrograma: Map<string, Map<string, number>>; faltan: number; ultima: string | null }
    >()
    for (const loc of localidadesFiltradas) {
      const dep = loc.departamento ?? 'Sin departamento'
      if (!map.has(dep)) {
        map.set(dep, { departamento: dep, localidades: 0, porPrograma: new Map(), faltan: 0, ultima: null })
      }
      const agg = map.get(dep)!
      agg.localidades += 1
      for (const p of loc.programas) {
        if (!agg.porPrograma.has(p.programa_label)) agg.porPrograma.set(p.programa_label, new Map())
        const estMap = agg.porPrograma.get(p.programa_label)!
        const est = p.estado_general_label ?? 'Sin estado'
        estMap.set(est, (estMap.get(est) ?? 0) + 1)
        agg.faltan += p.area === 'vivienda' && p.checklist_iniciado ? p.checklist_faltan : 0
        const f = p.ultima_comunicacion?.fecha ?? null
        if (f && (!agg.ultima || f > agg.ultima)) agg.ultima = f
      }
    }
    return [...map.values()].sort((a, b) => a.departamento.localeCompare(b.departamento, 'es'))
  }, [localidadesFiltradas])

  const alcance = payload?.generado_para_areas.map((a) => AREA_LABEL[a] ?? a).join(' + ') || '—'

  const hayFiltros = q || fDep || fArea || fProg || fEstado || fChecklist
  const limpiar = () => {
    setQ('')
    setFDep('')
    setFArea('')
    setFProg('')
    setFEstado('')
    setFChecklist('')
  }

  function exportar() {
    const rows = localidadesFiltradas.flatMap((loc) =>
      loc.programas.map((p) => ({
        Localidad: loc.localidad,
        Departamento: loc.departamento ?? '',
        Área: AREA_LABEL[p.area] ?? p.area,
        Programa: p.programa_label,
        Detalle: p.detalle ?? '',
        'Estado general': p.estado_general_label ?? '',
        'Checklist faltantes': p.area === 'vivienda' ? (p.checklist_iniciado ? p.checklist_faltan : p.checklist_total) : '',
        'Checklist total': p.area === 'vivienda' ? p.checklist_total : '',
        'Última comunicación (fecha)': p.ultima_comunicacion?.fecha ?? '',
        'Última comunicación (área)': p.ultima_comunicacion?.area ?? '',
        Monto: p.area === 'vivienda' ? fmtMonto(p.monto) : '',
        Expediente: p.expediente ?? '',
      })),
    )
    exportToXlsx(rows, 'Resumen territorial', `resumen_territorial_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div>
      {/* ── UI de pantalla ─────────────────────────────────────────────── */}
      <div className="rt-screen-only">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gov-navy">Resumen Territorial</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Programas y gestiones por localidad — Ministerio de Cooperativas y Mutuales
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {canActualizar && (
              <button
                onClick={() => actualizarMut.mutate()}
                disabled={actualizarMut.isPending}
                className="bg-gov-navy text-white text-sm px-4 py-2 rounded hover:bg-gov-navy/90 disabled:opacity-50"
              >
                {actualizarMut.isPending ? 'Calculando…' : '🔄 Actualizar'}
              </button>
            )}
            {snapshot && (
              <span className="text-[11px] text-gray-400">
                Actualizado {fmtHaceTiempo(snapshot.computed_at)}
                {snapshot.computed_by ? ` · ${snapshot.computed_by}` : ''}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {isLoading && <div className="text-sm text-gray-400 py-10 text-center">Cargando…</div>}

        {!isLoading && !snapshot && (
          <div className="bg-white rounded-lg border border-slate-200 px-6 py-12 text-center">
            <p className="text-gray-500 text-sm mb-4">Todavía no se calculó ningún resumen.</p>
            {canActualizar && (
              <button
                onClick={() => actualizarMut.mutate()}
                disabled={actualizarMut.isPending}
                className="bg-gov-cyan text-white text-sm px-5 py-2.5 rounded hover:bg-gov-cyan/90 disabled:opacity-50"
              >
                {actualizarMut.isPending ? 'Calculando…' : 'Calcular ahora'}
              </button>
            )}
          </div>
        )}

        {payload && payload.localidades.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-6 text-center text-sm text-amber-800">
            Tu área no tiene todavía un servicio conectado a este panel. Cuando lo tenga, vas a ver
            acá el resumen de tus programas por localidad.
          </div>
        )}

        {payload && payload.localidades.length > 0 && (
          <div className="space-y-4">
            <KpiStrip items={kpis} />

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex bg-slate-100 border border-slate-300 rounded-lg p-0.5">
                {(['localidad', 'departamento'] as Unidad[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnidad(u)}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      unidad === u ? 'bg-gov-cyan text-white' : 'text-gray-600'
                    }`}
                  >
                    Por {u}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">
                Alcance: <strong className="text-gov-navy">{alcance}</strong>
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={exportar}
                  className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:border-gov-cyan hover:text-gov-blue"
                >
                  ⤓ Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="text-sm bg-gov-cyan text-white rounded px-3 py-1.5 hover:brightness-105"
                >
                  ⎙ Imprimir
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-lg p-3">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar localidad o departamento…"
                className="text-sm bg-slate-50 border border-slate-300 rounded px-3 py-1.5 min-w-[200px] flex-1"
              />
              <select value={fDep} onChange={(e) => setFDep(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Todos los departamentos</option>
                {opciones.deps.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              {opciones.areas.length > 1 && (
                <select value={fArea} onChange={(e) => setFArea(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                  <option value="">Todas las áreas</option>
                  {opciones.areas.map((a) => (
                    <option key={a} value={a}>
                      {AREA_LABEL[a] ?? a}
                    </option>
                  ))}
                </select>
              )}
              <select value={fProg} onChange={(e) => setFProg(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Todos los programas</option>
                {opciones.progs.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Cualquier estado</option>
                {opciones.estados.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <select value={fChecklist} onChange={(e) => setFChecklist(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Checklist: cualquiera</option>
                <option value="con_faltantes">Con ítems faltantes</option>
                <option value="completo">Completo</option>
                <option value="no_iniciado">No iniciado</option>
              </select>
              {hayFiltros && (
                <button onClick={limpiar} className="text-xs text-gov-blue">
                  ✕ Limpiar
                </button>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {unidad === 'localidad'
                  ? `${localidadesFiltradas.length} localidades`
                  : `${porDepartamento.length} departamentos`}
              </span>
            </div>

            {/* Tabla */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              {unidad === 'localidad' ? (
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 w-[200px]">Localidad</th>
                      <th className="text-left px-4 py-2.5">
                        Programas · estado · checklist · última comunicación
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {localidadesFiltradas.map((loc, i) => (
                      <tr
                        key={i}
                        onClick={() => setDetalleLoc(loc)}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer align-top"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm text-gov-navy">{loc.localidad}</div>
                          <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                            {loc.departamento ?? 'Sin departamento'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            {loc.programas.map((p, j) => (
                              <div
                                key={j}
                                className="grid grid-cols-[160px_auto_1fr_auto] gap-2.5 items-center max-[720px]:grid-cols-2"
                              >
                                <span className="text-xs font-semibold text-gov-navy flex items-center gap-1.5">
                                  <span
                                    className="w-1.5 h-1.5 rounded-sm"
                                    style={{ background: p.area === 'privada' ? '#398ebd' : '#01aae3' }}
                                  />
                                  {p.programa_label}
                                </span>
                                <EstadoBadge prog={p} />
                                <ChecklistPill prog={p} />
                                <span className="text-[11px] text-gray-500 text-right">
                                  {p.ultima_comunicacion ? (
                                    <>
                                      <span className="font-semibold text-gov-navy">
                                        {fmtDate(p.ultima_comunicacion.fecha)}
                                      </span>
                                      {p.ultima_comunicacion.area
                                        ? ` · ${p.ultima_comunicacion.area}`
                                        : ''}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {localidadesFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-10 text-center text-sm text-gray-400">
                          Sin resultados con los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 w-[200px]">Departamento</th>
                      <th className="text-left px-4 py-2.5">Consolidado por programa</th>
                      <th className="text-left px-4 py-2.5 w-[130px]">Últ. comunicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDepartamento.map((d, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm text-gov-navy">{d.departamento}</div>
                          <div className="text-[11px] text-gray-400">
                            {d.localidades} localidad{d.localidades !== 1 ? 'es' : ''} ·{' '}
                            {d.faltan} ítems faltan
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {[...d.porPrograma.entries()].map(([prog, estMap]) => (
                              <div key={prog} className="text-xs flex flex-wrap gap-1.5 items-center">
                                <span className="font-semibold text-gov-navy min-w-[130px]">
                                  {prog}
                                </span>
                                {[...estMap.entries()].map(([est, n]) => (
                                  <span
                                    key={est}
                                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                                  >
                                    {est} · {n}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-500">{fmtDate(d.ultima)}</td>
                      </tr>
                    ))}
                    {porDepartamento.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                          Sin resultados con los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              Datos del último snapshot consolidado (svc-vivienda + Sec. Privada). Se recalcula con
              el botón “Actualizar” y automáticamente por tarea programada.
            </p>
          </div>
        )}
      </div>

      {/* ── Documento de impresión (oculto en pantalla) ─────────────────── */}
      {payload && (
        <div className="rt-print-doc hidden">
          <div style={{ borderBottom: '2px solid #14212b', paddingBottom: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#036aa1' }}>
              Ministerio de Cooperativas y Mutuales · Provincia de Córdoba
            </div>
            <h1 style={{ fontSize: 16, margin: '3px 0 0' }}>
              Resumen Territorial — {unidad === 'localidad' ? 'por localidad' : 'por departamento'}
            </h1>
          </div>
          <div style={{ fontSize: 9, color: '#4a5b68', marginBottom: 12 }}>
            Alcance: {alcance} &nbsp;|&nbsp; {localidadesFiltradas.length} localidades &nbsp;|&nbsp;
            Generado: {new Date().toLocaleString('es-AR')}
            {hayFiltros ? ' | (con filtros aplicados)' : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Localidad</th>
                <th>Departamento</th>
                <th>Área</th>
                <th>Programa</th>
                <th>Estado general</th>
                <th>Checklist</th>
                <th>Última comunicación</th>
              </tr>
            </thead>
            <tbody>
              {localidadesFiltradas.flatMap((loc) =>
                loc.programas.map((p, j) => (
                  <tr key={`${loc.localidad}-${j}`}>
                    {j === 0 && (
                      <td rowSpan={loc.programas.length}>
                        <b>{loc.localidad}</b>
                      </td>
                    )}
                    {j === 0 && (
                      <td rowSpan={loc.programas.length}>{loc.departamento ?? 'Sin depto.'}</td>
                    )}
                    <td>{AREA_LABEL[p.area] ?? p.area}</td>
                    <td>
                      {p.programa_label}
                      {p.detalle ? ` — ${p.detalle}` : ''}
                    </td>
                    <td>{p.estado_general_label ?? '—'}</td>
                    <td>
                      {p.area === 'privada'
                        ? '—'
                        : !p.checklist_iniciado
                          ? 'No iniciado'
                          : p.checklist_faltan === 0
                            ? 'Completo'
                            : `${p.checklist_faltan} / ${p.checklist_total} faltan`}
                    </td>
                    <td>
                      {p.ultima_comunicacion
                        ? `${fmtDate(p.ultima_comunicacion.fecha)}${
                            p.ultima_comunicacion.area ? ` · ${p.ultima_comunicacion.area}` : ''
                          }`
                        : '—'}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      <DetailDrawer localidad={detalleLoc} onClose={() => setDetalleLoc(null)} />
    </div>
  )
}
