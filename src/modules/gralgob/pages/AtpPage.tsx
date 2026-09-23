import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { atpApi, type Compromiso, type CronogramaPago } from '../api/atp.api'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'

// Panel preliminar de solo lectura (spec-sync-atp-compromiso-gobernador.md
// §12) — espeja atp_compromisos tal cual está sincronizado desde la hoja
// "BD" del Sheet "ATP - Compromiso Gobernador". Sin edición. Rediseñado
// (2026-09-21) siguiendo el patrón de los paneles de vivienda (Cordón
// Cuneta): filtros en cascada Departamento -> Localidad + tabla + panel
// lateral con el cronograma de pagos por localidad — mismo esquema que
// CordonCunetaPage.tsx (setDetailTarget -> DetailPanel).

function fmtMonto(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '$' + Math.round(Math.abs(n)).toLocaleString('es-AR')
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtMesAnio(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function fmtSincronizado(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutos = Math.round(diffMs / 60000)
  if (minutos < 1) return 'hace instantes'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function entregado(c: Compromiso): number {
  return Math.abs(c.total_pagado ?? 0)
}

function pendiente(c: Compromiso): number | null {
  if (c.monto === null || c.monto === undefined) return null
  return c.monto - entregado(c)
}

// ── Panel de detalle: cronograma de pagos de un compromiso ────────────────────

function DetailPanel({ compromiso, onClose }: { compromiso: Compromiso; onClose: () => void }) {
  const uid = useId()
  const { data: cronograma = [], isLoading } = useQuery({
    queryKey: ['gralgob-atp-cronograma', compromiso.id],
    queryFn: () => atpApi.cronograma(compromiso.id),
  })

  const entregadoTotal = entregado(compromiso)
  const pendienteTotal = pendiente(compromiso)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
        <div className="px-5 py-4 flex items-start justify-between border-b border-slate-200" style={{ background: 'var(--color-gov-navy)' }}>
          <div>
            <div className="text-[10px] font-semibold tracking-widest mb-0.5 text-gov-cyan uppercase">ATP — Compromiso Gobernador</div>
            <h3 id={`${uid}-t`} className="text-white font-semibold text-sm uppercase">{compromiso.localidad ?? 'Sin localidad'}</h3>
            {compromiso.departamento && <p className="text-xs mt-0.5 text-white/60 uppercase">{compromiso.departamento}</p>}
          </div>
          <button onClick={onClose} className="text-sky-300 hover:text-white text-xl leading-none ml-4 mt-0.5 transition-colors" aria-label="Cerrar">✕</button>
        </div>

        <div className="px-5 py-4 border-b border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 rounded px-2.5 py-2">
              <div className="text-gray-400 uppercase text-[10px] font-bold">Expediente</div>
              <div className="font-mono text-gray-700">{compromiso.nro_expediente || '—'}</div>
            </div>
            <div className="bg-slate-50 rounded px-2.5 py-2">
              <div className="text-gray-400 uppercase text-[10px] font-bold">Fecha de anuncio</div>
              <div className="font-semibold text-gray-700">{fmtFecha(compromiso.fecha_anuncio)}</div>
            </div>
            <div className="bg-slate-50 rounded px-2.5 py-2">
              <div className="text-gray-400 uppercase text-[10px] font-bold">Monto ATP</div>
              <div className="font-semibold text-gov-blue">{fmtMonto(compromiso.monto)}</div>
            </div>
            <div className="bg-slate-50 rounded px-2.5 py-2">
              <div className="text-gray-400 uppercase text-[10px] font-bold">Ministerio destino</div>
              <div className="font-semibold text-gray-700">{compromiso.ministerio_destino ?? '—'}</div>
            </div>
            <div className="bg-green-50 rounded px-2.5 py-2">
              <div className="text-green-700/70 uppercase text-[10px] font-bold">Entregado</div>
              <div className="font-semibold text-green-700">{fmtMonto(entregadoTotal)}</div>
            </div>
            <div className="bg-amber-50 rounded px-2.5 py-2">
              <div className="text-amber-700/70 uppercase text-[10px] font-bold">Pendiente</div>
              <div className="font-semibold text-amber-700">{pendienteTotal === null ? '—' : fmtMonto(pendienteTotal)}</div>
            </div>
          </div>
          {compromiso.destino && (
            <div className="bg-slate-50 rounded px-2.5 py-2">
              <div className="text-gray-400 uppercase text-[10px] font-bold">Destino</div>
              <div className="text-gray-700 text-xs">{compromiso.destino}</div>
            </div>
          )}
          {compromiso.derivado && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
              Este compromiso fue derivado a otra área para su ejecución.
            </p>
          )}
        </div>

        <div className="px-5 pt-3 pb-1">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gov-navy">Entregas de dinero</h4>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2" aria-live="polite">
          {isLoading && <p role="status" className="text-sm text-gray-400 text-center py-8">Cargando...</p>}
          {!isLoading && cronograma.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin entregas registradas todavía.</p>
          )}
          <ol className="space-y-3 pb-4">
            {cronograma.map((pago: CronogramaPago, i: number) => (
              <li key={pago.periodo} className="flex gap-3">
                <div className="flex flex-col items-center" aria-hidden="true">
                  <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: i === cronograma.length - 1 ? 'var(--color-gov-cyan)' : '#bae6fd' }} />
                  {i < cronograma.length - 1 && <div className="w-px flex-1 mt-1 bg-slate-200" />}
                </div>
                <div className="pb-1 flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 capitalize">{fmtMesAnio(pago.periodo)}</span>
                  <span className="text-sm font-semibold text-gov-navy whitespace-nowrap">{fmtMonto(pago.monto)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}

export function AtpPage() {
  const compromisosQ = useQuery({
    queryKey: ['gralgob-atp-compromisos'],
    queryFn: atpApi.compromisos,
    staleTime: 5 * 60 * 1000,
  })
  const syncEstadoQ = useQuery({
    queryKey: ['gralgob-atp-sync-estado'],
    queryFn: atpApi.syncEstado,
    staleTime: 60 * 1000,
  })

  const compromisos = compromisosQ.data?.items ?? []

  const deptoId = useId()
  const localidadId = useId()
  const ministerioId = useId()

  const [deptoFilter, setDeptoFilter] = useState('')
  const [localidadFilter, setLocalidadFilter] = useState('')
  const [ministerioFilter, setMinisterioFilter] = useState('')
  const [detailTarget, setDetailTarget] = useState<Compromiso | null>(null)

  const departamentos = useMemo(
    () => [...new Set(compromisos.map((c) => c.departamento).filter((d): d is string => !!d))].sort(),
    [compromisos],
  )
  // Localidad depende del departamento elegido — sin esto, el desplegable
  // mostraba las 246 localidades de toda la provincia sin importar el
  // departamento seleccionado, y elegir una combinación inválida devolvía
  // 0 resultados (reportado como "los filtros no funcionan").
  const localidades = useMemo(() => {
    const base = deptoFilter ? compromisos.filter((c) => c.departamento === deptoFilter) : compromisos
    return [...new Set(base.map((c) => c.localidad).filter((l): l is string => !!l))].sort()
  }, [compromisos, deptoFilter])
  const ministerios = useMemo(
    () => [...new Set(compromisos.map((c) => c.ministerio_destino).filter((m): m is string => !!m))].sort(),
    [compromisos],
  )

  // Si cambia el departamento y la localidad elegida ya no pertenece a él, se limpia.
  useEffect(() => {
    if (localidadFilter && !localidades.includes(localidadFilter)) {
      setLocalidadFilter('')
    }
  }, [localidades, localidadFilter])

  const compromisosFiltrados = useMemo(() => {
    return compromisos.filter((c) => {
      if (deptoFilter && c.departamento !== deptoFilter) return false
      if (localidadFilter && c.localidad !== localidadFilter) return false
      if (ministerioFilter && c.ministerio_destino !== ministerioFilter) return false
      return true
    })
  }, [compromisos, deptoFilter, localidadFilter, ministerioFilter])

  const hasFilters = !!(deptoFilter || localidadFilter || ministerioFilter)

  const kpis: Kpi[] = useMemo(() => {
    const montoTotal = compromisos.reduce((acc, c) => acc + (c.monto ?? 0), 0)
    const entregadoTotal = compromisos.reduce((acc, c) => acc + entregado(c), 0)
    const derivados = compromisos.filter((c) => c.derivado).length
    return [
      { value: compromisos.length, label: 'Compromisos ATP', accent: 'navy' },
      { value: fmtMonto(montoTotal), label: 'Monto total anunciado', accent: 'cyan' },
      { value: fmtMonto(entregadoTotal), label: 'Entregado a la fecha', accent: 'green' },
      { value: fmtMonto(montoTotal - entregadoTotal), label: 'Pendiente de entrega', accent: 'orange' },
      { value: derivados, label: 'Derivados a otra área', accent: 'navy' },
    ]
  }, [compromisos])

  const isLoading = compromisosQ.isLoading
  const isError = compromisosQ.isError

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gov-navy">ATP — Aporte del Tesoro Provincial</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Espejo de solo lectura del Sheet "ATP - Compromiso Gobernador" — compromisos
          anunciados por localidad. Panel preliminar: los datos se editan en el Sheet,
          acá solo se visualizan. Hacé clic en una localidad para ver el detalle de las entregas.
        </p>
      </div>

      {isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          No se pudo cargar el panel. Reintentá en unos segundos.
        </div>
      ) : isLoading ? (
        <p className="text-slate-400 text-sm">Cargando…</p>
      ) : (
        <div className="space-y-6">
          <KpiStrip items={kpis} />

          <div>
            <div className="bg-white border border-slate-200 rounded-t-md px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor={deptoId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Depto.</label>
                <select id={deptoId} value={deptoFilter} onChange={(e) => setDeptoFilter(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
                  <option value="">— Todos —</option>
                  {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor={localidadId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Localidad</label>
                <select id={localidadId} value={localidadFilter} onChange={(e) => setLocalidadFilter(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
                  <option value="">{deptoFilter ? `— Todas en ${deptoFilter} —` : '— Todas —'}</option>
                  {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor={ministerioId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Ministerio destino</label>
                <select id={ministerioId} value={ministerioFilter} onChange={(e) => setMinisterioFilter(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
                  <option value="">— Todos —</option>
                  {ministerios.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {hasFilters && (
                <button
                  onClick={() => { setDeptoFilter(''); setLocalidadFilter(''); setMinisterioFilter('') }}
                  className="border border-slate-200 rounded px-3 py-1 text-xs font-bold text-gray-600 hover:bg-slate-50 transition-colors"
                >
                  ✕ Limpiar filtros
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400" aria-live="polite">
                {compromisosFiltrados.length} {compromisosFiltrados.length === 1 ? 'compromiso' : 'compromisos'}
              </span>
            </div>

            <div className="bg-white rounded-b-md shadow-sm border border-t-0 border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-gov-navy)', color: '#fff' }}>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Departamento</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Localidad</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Expediente</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Ministerio destino</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Fecha anuncio</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Destino</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Monto</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Entregado</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Pendiente</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Derivado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compromisosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-10 text-gray-400">
                          Sin resultados para los filtros aplicados.
                        </td>
                      </tr>
                    )}
                    {compromisosFiltrados.map((c) => {
                      const pend = pendiente(c)
                      return (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition-colors">
                          <td className="px-2.5 py-1.5">
                            {c.departamento && (
                              <span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: '#E8EAF6', color: '#283593' }}>{c.departamento}</span>
                            )}
                          </td>
                          <td className="p-0 font-bold">
                            <button
                              onClick={() => setDetailTarget(c)}
                              className="w-full h-full px-2.5 py-1.5 text-left font-bold text-gov-navy hover:text-gov-cyan transition-colors group"
                              title="Ver entregas de dinero"
                            >
                              {c.localidad ?? '—'}
                              <span className="block text-[9px] font-normal text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity leading-none">Ver entregas</span>
                            </button>
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-gray-500 whitespace-nowrap" style={{ fontSize: '11px' }}>{c.nro_expediente || '—'}</td>
                          <td className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap">{c.ministerio_destino ?? '—'}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600">{fmtFecha(c.fecha_anuncio)}</td>
                          <td className="px-2.5 py-1.5 text-gray-500">{c.destino ?? '—'}</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(c.monto)}</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-green-700">{fmtMonto(entregado(c))}</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-amber-700">{pend === null ? '—' : fmtMonto(pend)}</td>
                          <td className="px-2.5 py-1.5">
                            {c.derivado && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 text-amber-700">
                                Derivado
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-300 text-right pt-1">
            {syncEstadoQ.data
              ? <>Sincronizado {fmtSincronizado(syncEstadoQ.data.finished_at ?? syncEstadoQ.data.started_at)} · datos de solo lectura (Sheet del área)</>
              : 'Sin datos de sincronización todavía'}
          </p>
        </div>
      )}

      {detailTarget && <DetailPanel compromiso={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  )
}
