import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { gestionesApi } from '../api/gestiones.api'
import type { EstadoGestion, CambioEstadoPayload } from '../types/gestiones.types'

const ESTADOS: { value: EstadoGestion; label: string }[] = [
  { value: 'INGRESADO', label: 'Ingresado' },
  { value: 'DERIVADO A SUAC', label: 'Derivado a SUAC' },
  { value: 'LISTA PARA INNAUGURAR', label: 'Lista para inaugurar' },
  { value: 'FINALIZADA', label: 'Finalizada' },
  { value: 'NO REMITE SUAC', label: 'No remite SUAC' },
  { value: 'ARCHIVADO', label: 'Archivado' },
]

const REQUIERE_COMENTARIO: EstadoGestion[] = ['ARCHIVADO', 'NO REMITE SUAC']

interface Props {
  gestionId: string | null
  estadoActual: string
  nroExpedienteActual?: string | null
  onClose: () => void
}

export function CambiarEstadoModal({ gestionId, estadoActual, nroExpedienteActual, onClose }: Props) {
  const qc = useQueryClient()

  const [nuevoEstado, setNuevoEstado] = useState<EstadoGestion>(estadoActual as EstadoGestion)
  const [comentario, setComentario] = useState('')
  const [nroExpediente, setNroExpediente] = useState(nroExpedienteActual ?? '')
  const [fechaIngreso, setFechaIngreso] = useState('')

  useEffect(() => {
    setNuevoEstado(estadoActual as EstadoGestion)
    setNroExpediente(nroExpedienteActual ?? '')
    setComentario('')
    setFechaIngreso('')
  }, [gestionId, estadoActual, nroExpedienteActual])

  useEffect(() => {
    if (!gestionId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gestionId, onClose])

  const mutation = useMutation({
    mutationFn: (payload: CambioEstadoPayload) => gestionesApi.cambiarEstado(gestionId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gestiones'] })
      qc.invalidateQueries({ queryKey: ['gestion-detalle', gestionId] })
      qc.invalidateQueries({ queryKey: ['gestion-eventos', gestionId] })
      onClose()
    },
  })

  const requireComentario = REQUIERE_COMENTARIO.includes(nuevoEstado)
  const canSubmit = !!nuevoEstado && (!requireComentario || comentario.trim().length > 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || mutation.isPending) return
    const payload: CambioEstadoPayload = {
      nuevo_estado: nuevoEstado,
      ...(comentario.trim() && { comentario: comentario.trim() }),
      ...(nroExpediente.trim() !== (nroExpedienteActual ?? '') && { nro_expediente: nroExpediente.trim() || undefined }),
      ...(fechaIngreso && { fecha_ingreso: fechaIngreso }),
    }
    mutation.mutate(payload)
  }

  if (!gestionId) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar estado de gestión"
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto">
          <div className="bg-gov-navy text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
            <h2 className="font-semibold">Modificar gestión</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="bg-slate-50 rounded px-3 py-2 text-xs text-slate-500">
              Estado actual:{' '}
              <span className="font-semibold text-slate-700">{estadoActual}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nuevo estado <span className="text-red-500">*</span>
              </label>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value as EstadoGestion)}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                required
              >
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nro expediente</label>
              <input
                type="text"
                value={nroExpediente}
                onChange={(e) => setNroExpediente(e.target.value)}
                placeholder="EXP-2026-…"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha ingreso</label>
              <input
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Comentario{requireComentario && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder={requireComentario ? 'Requerido para este estado…' : 'Opcional…'}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                required={requireComentario}
              />
            </div>

            {mutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                Error al guardar. Intentá de nuevo.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit || mutation.isPending}
                className="flex-1 bg-gov-navy text-white py-2 rounded text-sm hover:bg-gov-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
