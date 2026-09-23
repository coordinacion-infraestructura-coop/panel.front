import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gasiferaPitApi } from '../api/gasiferaPit.api'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'

// Panel preliminar de solo lectura (spec-sync-gasifera-pit.md §12) — espeja
// gas_pit_obras / gas_pit_acciones_territorio tal cual están sincronizadas desde
// el Sheet "SEC. GAS PIT". Sin edición. Esquema de filtros + tabla calcado del
// patrón de vivienda (CordonCunetaPage/CordobaHogarPage) — pedido explícito del
// usuario tras la primera versión (KPI + tablas planas, sin filtros).

function fmtMonto(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('es-AR')
}

function fmtPorcentaje(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `${Math.round(n * 100)}%`
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

function estadoObraColor(e: string | null) {
  const s = (e ?? '').toUpperCase()
  if (s.includes('FINALIZADA')) return 'bg-green-100 text-green-700'
  if (s.includes('EJECUCION')) return 'bg-sky-100 text-sky-700'
  if (s.includes('DETENIDA')) return 'bg-red-100 text-red-700'
  if (s.includes('PROYECTO') || s.includes('LICITAC') || s.includes('ADJUDICAC')) {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-slate-100 text-slate-600'
}

function estadoAccionColor(e: string) {
  const s = e.toUpperCase()
  if (s === 'CUMPLIDO') return 'bg-green-100 text-green-700'
  if (s === 'EN EJECUCIÓN' || s === 'EN EJECUCION') return 'bg-sky-100 text-sky-700'
  return 'bg-amber-100 text-amber-700'
}

export function GasiferaPitPage() {
  const obrasQ = useQuery({
    queryKey: ['gasifera-pit-obras'],
    queryFn: gasiferaPitApi.obras,
    staleTime: 5 * 60 * 1000,
  })
  const accionesQ = useQuery({
    queryKey: ['gasifera-pit-acciones'],
    queryFn: gasiferaPitApi.accionesTerritorio,
    staleTime: 5 * 60 * 1000,
  })
  const syncEstadoQ = useQuery({
    queryKey: ['gasifera-pit-sync-estado'],
    queryFn: gasiferaPitApi.syncEstado,
    staleTime: 60 * 1000,
  })

  const obras = obrasQ.data?.items ?? []
  const acciones = accionesQ.data?.items ?? []

  const deptoId = useId()
  const localidadId = useId()
  const estadoId = useId()

  const [deptoFilter, setDeptoFilter] = useState('')
  const [localidadFilter, setLocalidadFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')

  const departamentos = useMemo(
    () => [...new Set(acciones.map((a) => a.departamento).filter((d): d is string => !!d))].sort(),
    [acciones],
  )
  const localidades = useMemo(
    () => [...new Set(acciones.map((a) => a.localidad).filter((l): l is string => !!l))].sort(),
    [acciones],
  )
  const estados = useMemo(
    () => [...new Set(acciones.map((a) => a.estado))].sort(),
    [acciones],
  )

  const accionesFiltradas = useMemo(() => {
    return acciones.filter((a) => {
      if (deptoFilter && a.departamento !== deptoFilter) return false
      if (localidadFilter && a.localidad !== localidadFilter) return false
      if (estadoFilter && a.estado !== estadoFilter) return false
      return true
    })
  }, [acciones, deptoFilter, localidadFilter, estadoFilter])

  const hasFilters = !!(deptoFilter || localidadFilter || estadoFilter)

  const kpis: Kpi[] = useMemo(() => {
    const montoTotal = obras.reduce((acc, o) => acc + (o.importe_obra_actualizado ?? 0), 0)
    const avancePromedio = obras.length
      ? obras.reduce((acc, o) => acc + (o.avance ?? 0), 0) / obras.length
      : null
    const cumplidas = acciones.filter((a) => a.estado.toUpperCase() === 'CUMPLIDO').length
    const pendientes = acciones.length - cumplidas
    return [
      { value: obras.length, label: 'Obras de gas', accent: 'navy' },
      { value: fmtMonto(montoTotal), label: 'Monto total actualizado', accent: 'cyan' },
      { value: fmtPorcentaje(avancePromedio), label: 'Avance promedio', accent: 'green' },
      { value: cumplidas, label: 'Acciones cumplidas', accent: 'green' },
      { value: pendientes, label: 'Acciones pendientes / en curso', accent: 'orange' },
    ]
  }, [obras, acciones])

  const isLoading = obrasQ.isLoading || accionesQ.isLoading
  const isError = obrasQ.isError || accionesQ.isError

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gov-navy">Tablero PIT Gas</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Espejo de solo lectura del Sheet "SEC. GAS PIT" — obras de gas y acciones de
          seguimiento territorial. Panel preliminar: los datos se editan en el Sheet,
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

          {/* Acciones de seguimiento territorial — información principal del panel */}
          <div>
            <h3 className="text-sm font-semibold text-gov-navy mb-2">
              Acciones de seguimiento territorial
            </h3>

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
                <label htmlFor={estadoId} className="text-xs font-bold uppercase text-gray-500 whitespace-nowrap">Estado</label>
                <select id={estadoId} value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan">
                  <option value="">— Todos —</option>
                  {estados.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              {hasFilters && (
                <button
                  onClick={() => { setDeptoFilter(''); setLocalidadFilter(''); setEstadoFilter('') }}
                  className="border border-slate-200 rounded px-3 py-1 text-xs font-bold text-gray-600 hover:bg-slate-50 transition-colors"
                >
                  ✕ Limpiar filtros
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400" aria-live="polite">
                {accionesFiltradas.length} {accionesFiltradas.length === 1 ? 'acción' : 'acciones'}
              </span>
            </div>

            <div className="bg-white rounded-b-md shadow-sm border border-t-0 border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-gov-navy)', color: '#fff' }}>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Fecha</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Departamento</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Localidad</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Ministerio</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Área</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Acción</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Detalle de la acción</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Estado</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Monto solicitado</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Comentarios</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Monto USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accionesFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-10 text-gray-400">
                          Sin resultados para los filtros aplicados.
                        </td>
                      </tr>
                    )}
                    {accionesFiltradas.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition-colors">
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600">{a.fecha ?? '—'}</td>
                        <td className="px-2.5 py-1.5">
                          {a.departamento && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: '#E8EAF6', color: '#283593' }}>{a.departamento}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-600">{a.localidad ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{a.ministerio ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{a.area ?? '—'}</td>
                        <td className="px-2.5 py-1.5 font-medium text-gov-navy">{a.accion ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{a.detalle_accion ?? '—'}</td>
                        <td className="px-2.5 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${estadoAccionColor(a.estado)}`}>
                            {a.estado}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(a.monto_inversion_solicitado)}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{a.comentarios ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(a.monto_inversion_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Obras de gas */}
          <div>
            <h3 className="text-sm font-semibold text-gov-navy mb-2">Obras ({obras.length})</h3>
            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-gov-navy)', color: '#fff' }}>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Obra</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Tipo</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Contratista</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">Estado</th>
                      <th scope="col" className="px-2.5 py-2 text-left font-semibold">Departamento / Localidades</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Avance</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">Monto actualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obras.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-gray-400">Sin obras sincronizadas todavía.</td>
                      </tr>
                    )}
                    {obras.map((o) => (
                      <tr key={o.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition-colors">
                        <td className="px-2.5 py-1.5 font-medium text-gov-navy">{o.nombre_obra}</td>
                        <td className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap">{o.tipo_obra ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{o.contratista ?? '—'}</td>
                        <td className="px-2.5 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${estadoObraColor(o.estado_obra)}`}>
                            {o.estado_obra ?? '—'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-gray-500">
                          {o.departamento ?? '—'}
                          {o.localidades.length > 0 && (
                            <span className="text-gray-400"> · {o.localidades.join(', ')}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">{fmtPorcentaje(o.avance)}</td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtMonto(o.importe_obra_actualizado)}</td>
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
