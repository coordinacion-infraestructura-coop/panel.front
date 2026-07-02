import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gestionesApi } from '../api/gestiones.api'
import type { GestionDetalle, Evento } from '../types/gestiones.types'

interface Props {
  gestionId: string | null
  onClose: () => void
  onCambiarEstado: (id: string, estadoActual: string, nroExpediente?: string | null) => void
}

function formatFecha(fecha?: string) {
  if (!fecha) return '—'
  try {
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return fecha }
}

function formatFechaHora(fecha?: string) {
  if (!fecha) return '—'
  try {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return fecha }
}

const TIPO_EVENTO_LABEL: Record<string, string> = {
  CREACION: 'Creación',
  CAMBIO_ESTADO: 'Cambio de estado',
  ACTUALIZA_DATO: 'Dato actualizado',
  ARCHIVO: 'Archivado',
}

function tipoEventoBadge(tipo: string) {
  const t = tipo.toUpperCase()
  if (t === 'CREACION') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (t === 'CAMBIO_ESTADO') return 'bg-purple-50 text-purple-700 border-purple-200'
  if (t === 'ACTUALIZA_DATO') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (t === 'ARCHIVO') return 'bg-gray-100 text-gray-600 border-gray-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function EventoItem({ ev }: { ev: Evento }) {
  const tipo = ev.tipo_evento.toUpperCase()
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className="w-2 h-2 rounded-full bg-gov-navy" />
        <div className="w-px flex-1 bg-slate-200 mt-1" />
      </div>
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${tipoEventoBadge(ev.tipo_evento)}`}>
            {TIPO_EVENTO_LABEL[tipo] ?? ev.tipo_evento}
          </span>
          <span className="text-xs text-slate-400">{formatFechaHora(ev.fecha_evento)}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {ev.usuario}{ev.rol_usuario ? ` · ${ev.rol_usuario}` : ''}
        </p>
        {tipo === 'CAMBIO_ESTADO' && ev.estado_anterior && (
          <p className="text-xs mt-1 text-slate-700">
            <span className="text-slate-400 line-through">{ev.estado_anterior}</span>
            <span className="text-slate-400 mx-1.5">→</span>
            <span className="font-semibold text-gov-navy">{ev.estado_nuevo}</span>
          </p>
        )}
        {tipo === 'ACTUALIZA_DATO' && ev.campo_modificado && (
          <p className="text-xs mt-1 text-slate-700">
            <span className="font-medium">{ev.campo_modificado}:</span>{' '}
            {ev.valor_anterior && (
              <span className="line-through text-slate-400">{ev.valor_anterior}</span>
            )}
            {ev.valor_anterior && ev.valor_nuevo && <span className="text-slate-400 mx-1">→</span>}
            {ev.valor_nuevo && <span>{ev.valor_nuevo}</span>}
          </p>
        )}
        {ev.comentario && (
          <p className="text-xs text-slate-500 mt-1 italic">"{ev.comentario}"</p>
        )}
      </div>
    </div>
  )
}

function KV({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  )
}

export function GestionDetalleDrawer({ gestionId, onClose, onCambiarEstado }: Props) {
  useEffect(() => {
    if (!gestionId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gestionId, onClose])

  const { data: gestion, isLoading: loadingG } = useQuery<GestionDetalle>({
    queryKey: ['gestion-detalle', gestionId],
    queryFn: () => gestionesApi.get(gestionId!),
    enabled: !!gestionId,
  })

  const { data: eventos, isLoading: loadingEv } = useQuery<Evento[]>({
    queryKey: ['gestion-eventos', gestionId],
    queryFn: () => gestionesApi.getEventos(gestionId!),
    enabled: !!gestionId,
  })

  if (!gestionId) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de gestión"
      >
        {/* Header */}
        <div className="bg-gov-navy text-white px-5 py-4 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-white/60 font-mono mb-0.5">
              {gestion?.nro_expediente ?? gestion?.id_gestion ?? '…'}
            </p>
            <h2 className="text-base font-semibold leading-snug">
              {gestion ? `${gestion.localidad} · ${gestion.departamento}` : 'Cargando…'}
            </h2>
            {gestion && (
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {gestion.estado}
                </span>
                {gestion.urgencia && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    gestion.urgencia.toLowerCase() === 'alta' ? 'bg-red-500 text-white' :
                    gestion.urgencia.toLowerCase() === 'media' ? 'bg-yellow-400 text-slate-800' :
                    'bg-green-500 text-white'
                  }`}>
                    {gestion.urgencia}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors shrink-0 text-xl leading-none mt-1"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loadingG ? (
            <div className="p-6 text-center text-slate-400 text-sm">Cargando…</div>
          ) : gestion ? (
            <>
              {/* Resumen */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resumen</h3>
                  <button
                    onClick={() => onCambiarEstado(gestionId, gestion.estado, gestion.nro_expediente)}
                    className="text-xs bg-gov-navy text-white px-3 py-1.5 rounded hover:bg-gov-blue transition-colors"
                  >
                    Modificar estado
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <KV label="Fecha ingreso" value={formatFecha(gestion.fecha_ingreso)} />
                  <KV label="Nro expediente" value={gestion.nro_expediente} />
                  <KV label="Ministerio" value={gestion.ministerio_nombre ?? gestion.ministerio_agencia_id} />
                  <KV label="Categoría" value={gestion.categoria_nombre ?? gestion.categoria_general_id} />
                  <KV label="Tipo de gestión" value={gestion.tipo_gestion} />
                  <KV label="Canal origen" value={gestion.canal_origen} />
                  <KV label="Dirección" value={gestion.direccion} />
                  <KV label="Costo estimado" value={
                    gestion.costo_estimado
                      ? `${gestion.costo_estimado.toLocaleString('es-AR')} ${gestion.costo_moneda ?? ''}`.trim()
                      : null
                  } />
                  <KV label="Creado por" value={gestion.created_by} />
                  <KV label="Actualizado" value={formatFechaHora(gestion.updated_at)} />
                </dl>
                {gestion.detalle && (
                  <div className="mt-3">
                    <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Detalle</dt>
                    <dd className="text-sm text-slate-700 whitespace-pre-wrap">{gestion.detalle}</dd>
                  </div>
                )}
                {gestion.observaciones && (
                  <div className="mt-3">
                    <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Observaciones</dt>
                    <dd className="text-sm text-slate-700 whitespace-pre-wrap">{gestion.observaciones}</dd>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  Movimientos ({loadingEv ? '…' : (eventos?.length ?? 0)})
                </h3>
                {loadingEv ? (
                  <p className="text-sm text-slate-400">Cargando eventos…</p>
                ) : !eventos?.length ? (
                  <p className="text-sm text-slate-400">Sin eventos registrados.</p>
                ) : (
                  <div>
                    {eventos.map((ev) => <EventoItem key={ev.id_evento} ev={ev} />)}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
