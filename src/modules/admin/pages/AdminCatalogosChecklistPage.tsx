import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checklistTecnicoApi } from '../../vivienda/api/vivienda.api'
import type { ProgramaChecklist } from '../../vivienda/types/vivienda.types'

const PROGRAMA_OPTS: { value: ProgramaChecklist | ''; label: string }[] = [
  { value: '', label: 'Los 3 programas' },
  { value: 'cc', label: 'Cordón Cuneta' },
  { value: 'ch', label: 'Córdoba Hogar' },
  { value: 'ml', label: 'Mi Lugar' },
]

function errMsg(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'No tenés permisos para administrar los catálogos.'
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in (detail as Record<string, unknown>)) {
    return String((detail as Record<string, unknown>).message)
  }
  return 'No se pudo guardar el cambio.'
}

/** Siguiente `orden` libre (evita colisiones con seeds que tienen huecos). */
function nextOrden(rows: { orden: number }[]): number {
  return rows.length ? Math.max(...rows.map((r) => r.orden)) + 1 : 0
}

export function AdminCatalogosChecklistPage() {
  const qc = useQueryClient()
  const { data: catalogos, isLoading } = useQuery({ queryKey: ['checklist-catalogos'], queryFn: checklistTecnicoApi.getCatalogos })
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['checklist-catalogos'] })
  const onError = (err: unknown) => setError(errMsg(err))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gov-navy">Catálogos — Checklist Técnico DGV</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          "Estado del expediente", "Estado de la documentación" y "Repartición" — el área técnica los
          edita hoy a mano en la solapa "Validaciones" de la planilla; acá pasan a administrarse desde el sistema.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-center justify-between">
          {error}
          <button className="text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

      {catalogos && (
        <>
          <EstadoExpedienteTable estados={catalogos.estados_expediente} onSaved={invalidate} onError={onError} />
          <ItemEstadoTable itemsEstado={catalogos.items_estado} onSaved={invalidate} onError={onError} />
          <ReparticionTable reparticiones={catalogos.reparticiones} onSaved={invalidate} onError={onError} />
        </>
      )}
    </div>
  )
}

function EstadoExpedienteTable({
  estados, onSaved, onError,
}: {
  estados: { id: number; label: string; orden: number; activo: boolean; en_ruta: boolean }[]
  onSaved: () => void
  onError: (err: unknown) => void
}) {
  const [nuevoLabel, setNuevoLabel] = useState('')

  const createMut = useMutation({
    mutationFn: () => checklistTecnicoApi.createEstadoExpediente({ label: nuevoLabel, orden: nextOrden(estados) }),
    onSuccess: () => { setNuevoLabel(''); onSaved() },
    onError,
  })
  const updateMut = useMutation({
    mutationFn: (vars: { id: number; activo?: boolean; label?: string; en_ruta?: boolean }) =>
      checklistTecnicoApi.updateEstadoExpediente(vars.id, { activo: vars.activo, label: vars.label, en_ruta: vars.en_ruta }),
    onSuccess: onSaved,
    onError,
  })

  return (
    <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-gov-navy">Estado del expediente</h3>
        <p className="text-xs text-gray-400">
          Compartido entre Cordón Cuneta, Córdoba Hogar y Mi Lugar. El orden define el paso del stepper.
          "En ruta" destildado = estado de excepción (fuera del camino regular; se marca solo si el expediente lo transitó).
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase text-gray-400">
          <tr>
            <th className="px-4 py-2 font-semibold">Orden</th>
            <th className="px-4 py-2 font-semibold">Label</th>
            <th className="px-4 py-2 font-semibold">En ruta</th>
            <th className="px-4 py-2 font-semibold">Activo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {[...estados].sort((a, b) => a.orden - b.orden).map((e) => (
            <tr key={`${e.id}:${e.label}`}>
              <td className="px-4 py-2 text-gray-400 font-mono">{e.orden}</td>
              <td className="px-4 py-2">
                <input
                  defaultValue={e.label}
                  className="w-full border border-transparent hover:border-gray-200 focus:border-gov-cyan rounded px-1.5 py-1 text-sm"
                  onBlur={(ev) => { if (ev.target.value !== e.label) updateMut.mutate({ id: e.id, label: ev.target.value }) }}
                />
              </td>
              <td className="px-4 py-2">
                <input type="checkbox" checked={e.en_ruta} onChange={(ev) => updateMut.mutate({ id: e.id, en_ruta: ev.target.checked })} />
              </td>
              <td className="px-4 py-2">
                <input type="checkbox" checked={e.activo} onChange={(ev) => updateMut.mutate({ id: e.id, activo: ev.target.checked })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 border-t border-slate-100 flex gap-2">
        <input
          placeholder="Nuevo estado…"
          value={nuevoLabel}
          onChange={(e) => setNuevoLabel(e.target.value)}
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={!nuevoLabel.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
          className="text-sm font-semibold bg-gov-navy text-white rounded px-3 py-1.5 disabled:opacity-50"
        >
          + Agregar
        </button>
      </div>
    </section>
  )
}

function ItemEstadoTable({
  itemsEstado, onSaved, onError,
}: {
  itemsEstado: { id: number; label: string; orden: number; activo: boolean; bg: string; text_color: string; es_completo: boolean }[]
  onSaved: () => void
  onError: (err: unknown) => void
}) {
  const [nuevoLabel, setNuevoLabel] = useState('')

  const createMut = useMutation({
    mutationFn: () => checklistTecnicoApi.createItemEstado({ label: nuevoLabel, orden: nextOrden(itemsEstado) }),
    onSuccess: () => { setNuevoLabel(''); onSaved() },
    onError,
  })
  const updateMut = useMutation({
    mutationFn: (vars: { id: number; activo?: boolean; label?: string; es_completo?: boolean }) =>
      checklistTecnicoApi.updateItemEstado(vars.id, { activo: vars.activo, label: vars.label, es_completo: vars.es_completo }),
    onSuccess: onSaved,
    onError,
  })

  return (
    <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-gov-navy">Estado de la documentación</h3>
        <p className="text-xs text-gray-400">
          Valor de cada ítem del checklist "Documentación a presentar". "Terminado" marca el estado que
          cuenta como documentación completa en el Resumen Territorial y el Tablero.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase text-gray-400">
          <tr>
            <th className="px-4 py-2 font-semibold">Orden</th>
            <th className="px-4 py-2 font-semibold">Label</th>
            <th className="px-4 py-2 font-semibold">Terminado</th>
            <th className="px-4 py-2 font-semibold">Activo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {[...itemsEstado].sort((a, b) => a.orden - b.orden).map((e) => (
            <tr key={`${e.id}:${e.label}`}>
              <td className="px-4 py-2 text-gray-400 font-mono">{e.orden}</td>
              <td className="px-4 py-2">
                <span
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold"
                  style={{ background: e.bg, color: e.text_color }}
                >
                  <input
                    defaultValue={e.label}
                    className="bg-transparent border border-transparent hover:border-black/10 focus:border-black/20 rounded px-1 text-xs font-semibold"
                    style={{ color: e.text_color }}
                    onBlur={(ev) => { if (ev.target.value !== e.label) updateMut.mutate({ id: e.id, label: ev.target.value }) }}
                  />
                </span>
              </td>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={e.es_completo}
                  onChange={(ev) => updateMut.mutate({ id: e.id, es_completo: ev.target.checked })}
                />
              </td>
              <td className="px-4 py-2">
                <input type="checkbox" checked={e.activo} onChange={(ev) => updateMut.mutate({ id: e.id, activo: ev.target.checked })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 border-t border-slate-100 flex gap-2">
        <input
          placeholder="Nuevo estado…"
          value={nuevoLabel}
          onChange={(e) => setNuevoLabel(e.target.value)}
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={!nuevoLabel.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
          className="text-sm font-semibold bg-gov-navy text-white rounded px-3 py-1.5 disabled:opacity-50"
        >
          + Agregar
        </button>
      </div>
    </section>
  )
}

function ReparticionTable({
  reparticiones, onSaved, onError,
}: {
  reparticiones: { id: number; programa: ProgramaChecklist | null; label: string; orden: number; activo: boolean }[]
  onSaved: () => void
  onError: (err: unknown) => void
}) {
  const [nuevoLabel, setNuevoLabel] = useState('')
  const [nuevoPrograma, setNuevoPrograma] = useState<ProgramaChecklist | ''>('')

  const createMut = useMutation({
    mutationFn: () =>
      checklistTecnicoApi.createReparticion({ label: nuevoLabel, orden: nextOrden(reparticiones), programa: nuevoPrograma || null }),
    onSuccess: () => { setNuevoLabel(''); setNuevoPrograma(''); onSaved() },
    onError,
  })
  const updateMut = useMutation({
    mutationFn: (vars: { id: number; activo?: boolean; label?: string; programa?: ProgramaChecklist | null }) =>
      checklistTecnicoApi.updateReparticion(vars.id, { activo: vars.activo, label: vars.label, programa: vars.programa }),
    onSuccess: onSaved,
    onError,
  })

  return (
    <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-gov-navy">Repartición</h3>
        <p className="text-xs text-gray-400">Puede variar por programa — "Los 3 programas" aplica a Cordón Cuneta, Córdoba Hogar y Mi Lugar por igual.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase text-gray-400">
          <tr>
            <th className="px-4 py-2 font-semibold">Programa</th>
            <th className="px-4 py-2 font-semibold">Label</th>
            <th className="px-4 py-2 font-semibold">Activo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {reparticiones.map((r) => (
            <tr key={`${r.id}:${r.label}:${r.programa ?? ''}`}>
              <td className="px-4 py-2">
                <select
                  value={r.programa ?? ''}
                  onChange={(ev) => updateMut.mutate({ id: r.id, programa: (ev.target.value || null) as ProgramaChecklist | null })}
                  className="border border-gray-200 rounded px-1.5 py-1 text-xs"
                >
                  {PROGRAMA_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <input
                  defaultValue={r.label}
                  className="w-full border border-transparent hover:border-gray-200 focus:border-gov-cyan rounded px-1.5 py-1 text-sm"
                  onBlur={(ev) => { if (ev.target.value !== r.label) updateMut.mutate({ id: r.id, label: ev.target.value }) }}
                />
              </td>
              <td className="px-4 py-2">
                <input type="checkbox" checked={r.activo} onChange={(ev) => updateMut.mutate({ id: r.id, activo: ev.target.checked })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 border-t border-slate-100 flex gap-2">
        <select
          value={nuevoPrograma}
          onChange={(e) => setNuevoPrograma(e.target.value as ProgramaChecklist | '')}
          className="border border-gray-200 rounded px-2 py-1.5 text-sm"
        >
          {PROGRAMA_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          placeholder="Nueva repartición…"
          value={nuevoLabel}
          onChange={(e) => setNuevoLabel(e.target.value)}
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={!nuevoLabel.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
          className="text-sm font-semibold bg-gov-navy text-white rounded px-3 py-1.5 disabled:opacity-50"
        >
          + Agregar
        </button>
      </div>
    </section>
  )
}
