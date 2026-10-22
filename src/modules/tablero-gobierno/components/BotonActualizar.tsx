import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { tableroApi } from '../api/tablero.api'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
const AVISO_TERMINADO_MS = 30 * 60_000

/** Botón "Actualizar datos" (spec-tablero-gobierno-actualizar.md): dispara los jobs que traen las
 * fuentes. El backend informa en `/meta` si el último pedido sigue en curso y cuándo terminó (así
 * sobrevive a una recarga de la página). Mientras sigue, consulta cada 10 s y recarga las
 * pantallas cada vez que una fuente termina; normalmente tarda alrededor de un minuto. */
export function BotonActualizar() {
  const qc = useQueryClient()
  const [ahora, setAhora] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  const meta = useQuery({ queryKey: ['tablero-gobierno', 'meta'], queryFn: tableroApi.meta, staleTime: 5 * 60_000 })
  const pedido = meta.data?.actualizacion ?? null
  const desde = pedido ? new Date(pedido.pedido_en).getTime() : null
  const enCurso = !!pedido?.en_curso && ahora < new Date(pedido.proxima_desde).getTime()

  useEffect(() => {
    if (!enCurso) return
    const t = setInterval(() => {
      setAhora(Date.now())
      qc.invalidateQueries({ queryKey: ['tablero-gobierno', 'meta'] })
    }, 10_000)
    return () => clearInterval(t)
  }, [enCurso, qc])

  // Cada vez que termina una fuente (o el pedido entero), se recargan las pantallas (no la barra).
  const frescura = meta.data?.frescura ?? []
  const ultima = frescura.reduce((m, f) => (f.ultima_corrida && f.ultima_corrida > m ? f.ultima_corrida : m), '')
  useEffect(() => {
    if (desde == null || !ultima || new Date(ultima).getTime() < desde) return
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tablero-gobierno' && q.queryKey[1] !== 'meta' })
  }, [ultima, desde, pedido?.terminado_en, qc])

  const pedir = useMutation({
    mutationFn: tableroApi.actualizar,
    onMutate: () => setError(null),
    onSuccess: (r) => {
      if (!r.disparados.length) setError('No se pudo iniciar la actualización. Probá de nuevo en un rato o avisá al administrador.')
      setAhora(Date.now())
      qc.invalidateQueries({ queryKey: ['tablero-gobierno', 'meta'] })
    },
    onError: (e) => {
      // 409: ya hay una en curso (de otra persona, o de esta misma antes de recargar): se sigue esa.
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
  else if (pedido && enCurso) {
    estado = {
      tono: pedido.fallidos.length ? 'warn' : 'ok',
      texto: `Actualizando desde las ${hora(pedido.pedido_en)}: suele tardar alrededor de un minuto. Los datos se recargan solos.${
        pedido.fallidos.length ? ` No se pudieron iniciar: ${pedido.fallidos.join(', ')}.` : ''
      }`,
    }
  } else if (pedido?.terminado_en && ahora - new Date(pedido.terminado_en).getTime() < AVISO_TERMINADO_MS) {
    const conError = frescura.filter((f) => f.estado === 'fallido' && f.ultima_corrida && new Date(f.ultima_corrida).getTime() >= desde!)
    estado = conError.length
      ? { tono: 'warn', texto: `Actualización terminada a las ${hora(pedido.terminado_en)}, con errores en: ${conError.map((f) => f.etiqueta).join(', ')}.` }
      : { tono: 'ok', texto: `Datos actualizados a las ${hora(pedido.terminado_en)}.` }
  } else if (pedido && !pedido.terminado_en && !enCurso && desde != null && ahora - desde < AVISO_TERMINADO_MS) {
    estado = { tono: 'warn', texto: 'La última actualización no terminó en 15 minutos. Revisá la frescura de las fuentes o pedila de nuevo.' }
  }

  const colores = { ok: 'text-emerald-800 bg-emerald-50 border-emerald-200', warn: 'text-amber-800 bg-amber-50 border-amber-200', error: 'text-red-700 bg-red-50 border-red-200' }
  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[360px]">
      <button
        type="button"
        onClick={() => pedir.mutate()}
        disabled={pedir.isPending || enCurso}
        className="inline-flex items-center gap-2 text-xs font-medium border border-gov-blue text-gov-blue rounded-full px-3 py-1.5 hover:bg-gov-blue hover:text-white disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gov-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan"
      >
        <span aria-hidden="true" className={pedir.isPending || enCurso ? 'animate-spin' : ''}>⟳</span>
        {pedir.isPending ? 'Pidiendo…' : enCurso ? 'Actualizando…' : 'Actualizar datos'}
      </button>
      {estado && (
        <p role="status" className={`text-xs border rounded-md px-2.5 py-1.5 ${colores[estado.tono]}`}>
          {estado.texto}
        </p>
      )}
    </div>
  )
}
