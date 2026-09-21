import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { atpApi } from '../api/atp.api'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'

// Panel preliminar de solo lectura (spec-sync-atp-compromiso-gobernador.md
// §12) — espeja atp_compromisos tal cual está sincronizado desde la hoja
// "BD" del Sheet "ATP - Compromiso Gobernador". Sin edición. Mismo esquema
// de KPI strip + filtros + tabla que el Tablero PIT Gas de gasifera.

function fmtMonto(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '$' + Math.round(Math.abs(n)).toLocaleString('es-AR')
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

  const departamentos = useMemo(
    () => [...new Set(compromisos.map((c) => c.departamento).filter((d): d is string => !!d))].sort(),
    [compromisos],
  )
  const localidades = useMemo(
    () => [...new Set(compromisos.map((c) => c.localidad).filter((l): l is string => !!l))].sort(),
    [compromisos],
  )
  const ministerios = useMemo(
    () => [...new Set(compromisos.map((c) => c.ministerio_destino).filter((m): m is string => !!m))].sort(),
    [compromisos],
  )

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
    const saldoPendiente = compromisos.reduce((acc, c) => acc + (c.saldo_atp ?? 0), 0)
    const totalPagado = compromisos.reduce((acc, c) => acc + Math.abs(c.total_pagado ?? 0), 0)
    const derivados = compromisos.filter((c) => c.derivado).length
    return [
      { value: compromisos.length, label: 'Compromisos ATP', accent: 'navy' },
      { value: fmtMonto(montoTotal), label: 'Monto total anunciado', accent: 'cyan' },
      { value: fmtMonto(saldoPendiente), label: 'Saldo pendiente (Gobierno)', accent: 'orange' },
      { value: fmtMonto(totalPagado), label: 'Total pagado a la fecha', accent: 'green' },
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
          acá solo se visualizan.
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
                  <option value="">— Todas —</option>
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
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Ministerio destino</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Fecha anuncio</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Destino</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Monto</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Pagado</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Saldo ATP</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Derivado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compromisosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-gray-400">
                          Sin resultados para los filtros aplicados.
                        </td>
                      </tr>
                    )}
                    {compromisosFiltrados.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition-colors">
                        <td className="px-2.5 py-1.5">
                          {c.departamento && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: '#E8EAF6', color: '#283593' }}>{c.departamento}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600">{c.localidad ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap">{c.ministerio_destino ?? '—'}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600">{c.fecha_anuncio ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{c.destino ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(c.monto)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(c.total_pagado)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(c.saldo_atp)}</td>
                        <td className="px-2.5 py-1.5">
                          {c.derivado && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 text-amber-700">
                              Derivado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
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
    </div>
  )
}
