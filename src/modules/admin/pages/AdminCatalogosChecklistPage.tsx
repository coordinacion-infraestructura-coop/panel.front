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

export function AdminCatalogosChecklistPage() {
  const qc = useQueryClient()
  const { data: catalogos, isLoading } = useQuery({ queryKey: ['checklist-catalogos'], queryFn: checklistTecnicoApi.getCatalogos })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['checklist-catalogos'] })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gov-navy">Catálogos — Checklist Técnico DGV</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          "Estado del expediente" y "Repartición" — el área técnica los edita hoy a mano en la solapa
          "Validaciones" de la planilla; acá pasan a administrarse desde el sistema.
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

      {catalogos && (
        <>
          <EstadoExpedienteTable estados={catalogos.estados_expediente} onSaved={invalidate} />
          <ReparticionTable reparticiones={catalogos.reparticiones} onSaved={invalidate} />
        </>
      )}
    </div>
  )
}

function EstadoExpedienteTable({
  estados, onSaved,
}: {
  estados: { id: number; label: string; orden: number; activo: boolean }[]
  onSaved: () => void
}) {
  const [nuevoLabel, setNuevoLabel] = useState('')

  const createMut = useMutation({
    mutationFn: () => checklistTecnicoApi.createEstadoExpediente({ label: nuevoLabel, orden: estados.length }),
    onSuccess: () => { setNuevoLabel(''); onSaved() },
  })
  const updateMut = useMutation({
    mutationFn: (vars: { id: number; activo?: boolean; label?: string }) =>
      checklistTecnicoApi.updateEstadoExpediente(vars.id, { activo: vars.activo, label: vars.label }),
    onSuccess: onSaved,
  })

  return (
    <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-gov-navy">Estado del expediente</h3>
        <p className="text-xs text-gray-400">Compartido entre Cordón Cuneta, Córdoba Hogar y Mi Lugar. El orden define el paso del stepper.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase text-gray-400">
          <tr>
            <th className="px-4 py-2 font-semibold">Orden</th>
            <th className="px-4 py-2 font-semibold">Label</th>
            <th className="px-4 py-2 font-semibold">Activo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {[...estados].sort((a, b) => a.orden - b.orden).map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-2 text-gray-400 font-mono">{e.orden}</td>
              <td className="px-4 py-2">
                <input
                  defaultValue={e.label}
                  className="w-full border border-transparent hover:border-gray-200 focus:border-gov-cyan rounded px-1.5 py-1 text-sm"
                  onBlur={(ev) => { if (ev.target.value !== e.label) updateMut.mutate({ id: e.id, label: ev.target.value }) }}
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
  reparticiones, onSaved,
}: {
  reparticiones: { id: number; programa: ProgramaChecklist | null; label: string; orden: number; activo: boolean }[]
  onSaved: () => void
}) {
  const [nuevoLabel, setNuevoLabel] = useState('')
  const [nuevoPrograma, setNuevoPrograma] = useState<ProgramaChecklist | ''>('')

  const createMut = useMutation({
    mutationFn: () =>
      checklistTecnicoApi.createReparticion({ label: nuevoLabel, orden: reparticiones.length, programa: nuevoPrograma || null }),
    onSuccess: () => { setNuevoLabel(''); setNuevoPrograma(''); onSaved() },
  })
  const updateMut = useMutation({
    mutationFn: (vars: { id: number; activo?: boolean; label?: string; programa?: ProgramaChecklist | null }) =>
      checklistTecnicoApi.updateReparticion(vars.id, { activo: vars.activo, label: vars.label, programa: vars.programa }),
    onSuccess: onSaved,
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
            <tr key={r.id}>
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
