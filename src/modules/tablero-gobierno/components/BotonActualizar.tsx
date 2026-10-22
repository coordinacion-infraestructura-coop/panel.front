import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { tableroApi } from '../api/tablero.api'

const MINUTOS_SEGUIMIENTO = 15
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

/** Botón "Actualizar datos" (spec-tablero-gobierno-actualizar.md): dispara los jobs que traen las
 * fuentes. Los syncs tardan minutos, así que mientras dura el seguimiento consulta la frescura cada
 * 30 s y recarga las pantallas cada vez que una fuente termina. */
export function BotonActualizar() {
  const qc = useQueryClient()
  const [desde, setDesde] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn' | 'error'; texto: string } | null>(null)
  const siguiendo = desde != null && Date.now() - desde < MINUTOS_SEGUIMIENTO * 60_000

  const meta = useQuery({
    queryKey: ['tablero-gobierno', 'meta'],
    queryFn: tableroApi.meta,
    staleTime: 5 * 60_000,
    refetchInterval: siguiendo ? 30_000 : false,
  })
  const ultima = (meta.data?.frescura ?? []).reduce((m, f) => (f.ultima_corrida && f.ultima_corrida > m ? f.ultima_corrida : m), '')

  // Cada vez que termina una fuente, se recargan los datos de las pantallas (no la barra).
  useEffect(() => {
    if (!siguiendo || !ultima || new Date(ultima).getTime() < desde!) return
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tablero-gobierno' && q.queryKey[1] !== 'meta' })
  }, [ultima, siguiendo, desde, qc])

  useEffect(() => {
    if (desde == null) return
    const t = setTimeout(() => {
      setDesde(null)
      setAviso((a) => (a?.tono === 'ok' ? { tono: 'ok', texto: 'Actualización terminada. Si alguna fuente falló, lo indica la frescura de las fuentes.' } : a))
    }, MINUTOS_SEGUIMIENTO * 60_000)
    return () => clearTimeout(t)
  }, [desde])

  const pedir = useMutation({
    mutationFn: tableroApi.actualizar,
    onSuccess: (r) => {
      if (!r.disparados.length) {
        setAviso({ tono: 'error', texto: 'No se pudo iniciar la actualización. Probá de nuevo en un rato o avisá al administrador.' })
        return
      }
      setDesde(Date.now())
      setAviso({
        tono: r.fallidos.length ? 'warn' : 'ok',
        texto: `Actualización en curso: los datos se van recargando a medida que cada planilla termina (unos minutos).${
          r.fallidos.length ? ` No se pudieron iniciar: ${r.fallidos.join(', ')}.` : ''
        }`,
      })
    },
    onError: (e) => {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        const anterior = e.response.data?.detail?.anterior as string | undefined
        setAviso({
          tono: 'warn',
          texto: anterior
            ? `Ya se pidió una actualización a las ${hora(anterior)}. Se puede volver a pedir 15 minutos después.`
            : 'Ya se pidió una actualización hace menos de 15 minutos.',
        })
        return
      }
      setAviso({ tono: 'error', texto: 'No se pudo pedir la actualización. Probá de nuevo en un rato.' })
    },
  })

  const colores = { ok: 'text-emerald-800 bg-emerald-50 border-emerald-200', warn: 'text-amber-800 bg-amber-50 border-amber-200', error: 'text-red-700 bg-red-50 border-red-200' }
  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[360px]">
      <button
        type="button"
        onClick={() => pedir.mutate()}
        disabled={pedir.isPending || siguiendo}
        className="inline-flex items-center gap-2 text-xs font-medium border border-gov-blue text-gov-blue rounded-full px-3 py-1.5 hover:bg-gov-blue hover:text-white disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gov-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
      >
        <span aria-hidden="true" className={pedir.isPending || siguiendo ? 'animate-spin' : ''}>⟳</span>
        {pedir.isPending ? 'Pidiendo…' : siguiendo ? 'Actualizando…' : 'Actualizar datos'}
      </button>
      {aviso && (
        <p role="status" className={`text-xs border rounded-md px-2.5 py-1.5 ${colores[aviso.tono]}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  )
}
