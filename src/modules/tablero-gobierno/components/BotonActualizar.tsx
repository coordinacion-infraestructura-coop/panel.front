import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { tableroApi } from '../api/tablero.api'

const hora = (iso: string | number) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

/** Botón "Actualizar datos" (spec-tablero-gobierno-actualizar.md): dispara los jobs que traen las
 * fuentes. Los syncs tardan minutos: mientras dura la ventana de 15 minutos del último pedido
 * (la informa el backend en `/meta`, así sobrevive a una recarga de la página) consulta la
 * frescura cada 30 s y recarga las pantallas cada vez que una fuente termina. */
export function BotonActualizar() {
  const qc = useQueryClient()
  const [ahora, setAhora] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  const meta = useQuery({ queryKey: ['tablero-gobierno', 'meta'], queryFn: tableroApi.meta, staleTime: 5 * 60_000 })
  const pedido = meta.data?.actualizacion ?? null
  const desde = pedido ? new Date(pedido.pedido_en).getTime() : null
  const hasta = pedido ? new Date(pedido.proxima_desde).getTime() : null
  const siguiendo = hasta != null && ahora < hasta

  // Reloj para saber cuándo termina la ventana, y consulta de la frescura mientras dura.
  useEffect(() => {
    if (!siguiendo) return
    const t = setInterval(() => {
      setAhora(Date.now())
      qc.invalidateQueries({ queryKey: ['tablero-gobierno', 'meta'] })
    }, 30_000)
    return () => clearInterval(t)
  }, [siguiendo, qc])

  // Cada vez que termina una fuente, se recargan los datos de las pantallas (no la barra).
  const ultima = (meta.data?.frescura ?? []).reduce((m, f) => (f.ultima_corrida && f.ultima_corrida > m ? f.ultima_corrida : m), '')
  useEffect(() => {
    if (!siguiendo || !ultima || desde == null || new Date(ultima).getTime() < desde) return
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tablero-gobierno' && q.queryKey[1] !== 'meta' })
  }, [ultima, siguiendo, desde, qc])

  const pedir = useMutation({
    mutationFn: tableroApi.actualizar,
    onMutate: () => setError(null),
    onSuccess: (r) => {
      if (!r.disparados.length) setError('No se pudo iniciar la actualización. Probá de nuevo en un rato o avisá al administrador.')
      setAhora(Date.now())
      qc.invalidateQueries({ queryKey: ['tablero-gobierno', 'meta'] })
    },
    onError: (e) => {
      // 409: otra persona (o esta misma, antes de recargar) ya la pidió: no es un error, se sigue esa.
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setAhora(Date.now())
        qc.invalidateQueries({ queryKey: ['tablero-gobierno', 'meta'] })
        return
      }
      setError('No se pudo pedir la actualización. Probá de nuevo en un rato.')
    },
  })

  let estado: { tono: 'ok' | 'warn' | 'error'; texto: string } | null = null
  if (error) estado = { tono: 'error', texto: error }
  else if (siguiendo && pedido) {
    estado = {
      tono: pedido.fallidos.length ? 'warn' : 'ok',
      texto: `Actualización pedida a las ${hora(pedido.pedido_en)}: los datos se van recargando a medida que termina cada planilla (unos minutos). Se puede volver a pedir a las ${hora(pedido.proxima_desde)}.${
        pedido.fallidos.length ? ` No se pudieron iniciar: ${pedido.fallidos.join(', ')}.` : ''
      }`,
    }
  }

  const colores = { ok: 'text-emerald-800 bg-emerald-50 border-emerald-200', warn: 'text-amber-800 bg-amber-50 border-amber-200', error: 'text-red-700 bg-red-50 border-red-200' }
  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[360px]">
      <button
        type="button"
        onClick={() => pedir.mutate()}
        disabled={pedir.isPending || siguiendo}
        title={siguiendo && pedido ? `Ya hay una actualización en curso. Se puede volver a pedir a las ${hora(pedido.proxima_desde)}.` : undefined}
        className="inline-flex items-center gap-2 text-xs font-medium border border-gov-blue text-gov-blue rounded-full px-3 py-1.5 hover:bg-gov-blue hover:text-white disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gov-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
      >
        <span aria-hidden="true" className={pedir.isPending || siguiendo ? 'animate-spin' : ''}>⟳</span>
        {pedir.isPending ? 'Pidiendo…' : siguiendo ? 'Actualizando…' : 'Actualizar datos'}
      </button>
      {estado && (
        <p role="status" className={`text-xs border rounded-md px-2.5 py-1.5 ${colores[estado.tono]}`}>
          {estado.texto}
        </p>
      )}
    </div>
  )
}
