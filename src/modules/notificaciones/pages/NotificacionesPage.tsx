import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificacionesApi } from '../api/notificaciones.api'
import type { NivelNotificacion, Notificacion } from '../types/notificaciones.types'

const NIVEL_PILL: Record<NivelNotificacion, string> = {
  info: 'bg-sky-100 text-sky-700',
  exito: 'bg-green-100 text-green-700',
  advertencia: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
}
const NIVEL_LABEL: Record<NivelNotificacion, string> = {
  info: 'Info',
  exito: 'Éxito',
  advertencia: 'Advertencia',
  error: 'Error',
}

function hace(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `hace ${d} d`
  return new Date(iso).toLocaleDateString('es-AR')
}

function Fila({ n, onLeida, marcando }: { n: Notificacion; onLeida: (id: string) => void; marcando: boolean }) {
  return (
    <div
      className={`px-4 py-3 flex gap-3 ${n.leida ? 'bg-white' : 'bg-sky-50/40'}`}
    >
      <span
        className={`mt-0.5 shrink-0 h-fit text-[11px] font-medium px-2 py-0.5 rounded-full ${NIVEL_PILL[n.nivel] ?? 'bg-slate-100 text-slate-600'}`}
      >
        {NIVEL_LABEL[n.nivel] ?? n.nivel}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${n.leida ? 'font-medium text-slate-700' : 'font-semibold text-gov-navy'}`}>
            {n.titulo}
          </p>
          {!n.leida && (
            <button
              onClick={() => onLeida(n.id)}
              disabled={marcando}
              className="shrink-0 text-xs text-gov-blue hover:underline disabled:opacity-50"
            >
              Marcar leída
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{n.mensaje}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="uppercase tracking-wide">{n.origen}</span>
          <span aria-hidden="true">·</span>
          <span>{hace(n.created_at)}</span>
          {n.enlace && (
            <>
              <span aria-hidden="true">·</span>
              <Link to={n.enlace} className="text-gov-blue hover:underline">
                Ver
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotificacionesPage() {
  const qc = useQueryClient()
  const [soloNoLeidas, setSoloNoLeidas] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notificaciones', soloNoLeidas],
    queryFn: () => notificacionesApi.list({ solo_no_leidas: soloNoLeidas, limit: 200 }),
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['notificaciones'] })
    qc.invalidateQueries({ queryKey: ['notificaciones-contador'] })
  }

  const marcarUna = useMutation({
    mutationFn: (id: string) => notificacionesApi.marcarLeida(id),
    onSuccess: invalidar,
  })
  const marcarTodas = useMutation({
    mutationFn: () => notificacionesApi.marcarTodasLeidas(),
    onSuccess: invalidar,
  })

  const items = data?.items ?? []

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Notificaciones</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Alertas internas del sistema
            {data ? ` · ${data.no_leidas} sin leer` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={soloNoLeidas}
              onChange={(e) => setSoloNoLeidas(e.target.checked)}
            />
            Solo no leídas
          </label>
          <button
            onClick={() => marcarTodas.mutate()}
            disabled={marcarTodas.isPending || (data?.no_leidas ?? 0) === 0}
            className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:border-gov-cyan hover:text-gov-blue disabled:opacity-40"
          >
            {marcarTodas.isPending ? '…' : 'Marcar todas como leídas'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {isError ? (
          <div role="alert" className="p-8 text-center text-sm text-red-700 bg-red-50">
            No se pudieron cargar las notificaciones. Reintentá en unos segundos.
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {soloNoLeidas ? 'No tenés notificaciones sin leer.' : 'No hay notificaciones.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((n) => (
              <Fila
                key={n.id}
                n={n}
                onLeida={(id) => marcarUna.mutate(id)}
                marcando={marcarUna.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
