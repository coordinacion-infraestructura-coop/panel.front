import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gestionesApi } from '../api/gestiones.api'
import type { EstadoGestion, CambioEstadoPayload, GestionDetalle } from '../types/gestiones.types'

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
  const [derivadoA, setDerivadoA] = useState('')
  const [acciones, setAcciones] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [localidad, setLocalidad] = useState('')
  // valores originales de depto/localidad para enviar sólo si cambian
  const [origen, setOrigen] = useState<{ departamento: string; localidad: string }>({ departamento: '', localidad: '' })

  // Detalle de la gestión — para prefilar departamento / localidad actuales
  const { data: detalle } = useQuery<GestionDetalle>({
    queryKey: ['gestion-detalle', gestionId],
    queryFn: () => gestionesApi.get(gestionId!),
    enabled: !!gestionId,
  })

  const { data: departamentos } = useQuery<string[]>({
    queryKey: ['privada-cat-departamentos'],
    queryFn: () => gestionesApi.catalogo('departamentos'),
    staleTime: Infinity,
  })
  const { data: localidades } = useQuery<string[]>({
    queryKey: ['privada-cat-localidades', departamento],
    queryFn: () => gestionesApi.catalogoLocalidades(departamento),
    enabled: !!gestionId && !!departamento,
    staleTime: Infinity,
  })

  useEffect(() => {
    setNuevoEstado(estadoActual as EstadoGestion)
    setNroExpediente(nroExpedienteActual ?? '')
    setComentario('')
    setFechaIngreso('')
    setDerivadoA('')
    setAcciones('')
  }, [gestionId, estadoActual, nroExpedienteActual])

  useEffect(() => {
    if (detalle) {
      const dep = detalle.departamento ?? ''
      const loc = detalle.localidad ?? ''
      setDepartamento(dep)
      setLocalidad(loc)
      setOrigen({ departamento: dep, localidad: loc })
    }
  }, [detalle])

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
  const canSubmit = !!nuevoEstado && !!departamento && !!localidad &&
    (!requireComentario || comentario.trim().length > 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || mutation.isPending) return
    const deptoCambio = departamento !== origen.departamento
    const locCambio = localidad !== origen.localidad
    const payload: CambioEstadoPayload = {
      nuevo_estado: nuevoEstado,
      ...(comentario.trim() && { comentario: comentario.trim() }),
      ...(nroExpediente.trim() !== (nroExpedienteActual ?? '') && { nro_expediente: nroExpediente.trim() || undefined }),
      ...(fechaIngreso && { fecha_ingreso: fechaIngreso }),
      ...(derivadoA.trim() && { derivado_a: derivadoA.trim() }),
      ...(acciones.trim() && { acciones_implementadas: acciones.trim() }),
      ...((deptoCambio || locCambio) && { departamento, localidad }),
    }
    mutation.mutate(payload)
  }

  if (!gestionId) return null

  const inputCls = 'w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan bg-white disabled:bg-slate-50 disabled:text-slate-400'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-0 z-60 flex items-start justify-center p-4 overflow-y-auto pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar estado de gestión"
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8 pointer-events-auto">
          <div className="bg-gov-navy text-white px-5 py-4 rounded-t-xl flex items-center justify-between sticky top-0">
            <h2 className="font-semibold">Modificar gestión</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="bg-slate-50 rounded px-3 py-2 text-xs text-slate-500">
              Estado actual: <span className="font-semibold text-slate-700">{estadoActual}</span>
            </div>

            <div>
              <label className={labelCls}>
                Nuevo estado <span className="text-red-500">*</span>
              </label>
              <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value as EstadoGestion)}
                className={inputCls} required>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Derivado a</label>
              <input type="text" value={derivadoA} onChange={(e) => setDerivadoA(e.target.value)}
                placeholder="Área / persona / organismo" className={inputCls} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nro expediente</label>
                <input type="text" value={nroExpediente} onChange={(e) => setNroExpediente(e.target.value)}
                  placeholder="EXP-2026-…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha ingreso</label>
                <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)}
                  className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Departamento <span className="text-red-500">*</span>
                </label>
                <select value={departamento}
                  onChange={(e) => { setDepartamento(e.target.value); setLocalidad('') }}
                  className={inputCls} required>
                  <option value="">(Seleccionar)</option>
                  {(departamentos ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Localidad <span className="text-red-500">*</span>
                </label>
                <select value={localidad} onChange={(e) => setLocalidad(e.target.value)}
                  className={inputCls} disabled={!departamento} required>
                  <option value="">{departamento ? '(Seleccionar)' : 'Elegí un departamento'}</option>
                  {/* mantiene la localidad original aunque el catálogo aún no cargó */}
                  {localidad && !(localidades ?? []).includes(localidad) && (
                    <option value={localidad}>{localidad}</option>
                  )}
                  {(localidades ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Acciones implementadas</label>
              <textarea value={acciones} onChange={(e) => setAcciones(e.target.value)} rows={3}
                placeholder="Qué se hizo / pasos realizados…"
                className={`${inputCls} resize-none`} />
            </div>

            <div>
              <label className={labelCls}>
                Comentario{requireComentario && <span className="text-red-500"> *</span>}
              </label>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3}
                placeholder={requireComentario ? 'Requerido para este estado…' : 'Opcional…'}
                className={`${inputCls} resize-none`} required={requireComentario} />
            </div>

            {mutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                Error al guardar. Intentá de nuevo.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded text-sm hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={!canSubmit || mutation.isPending}
                className="flex-1 bg-gov-navy text-white py-2 rounded text-sm hover:bg-gov-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {mutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
