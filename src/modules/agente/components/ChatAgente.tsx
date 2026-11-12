// Chat del asistente de consultas (spec-agente-consultas.md §8). Lo usan la página /agente y la
// burbuja flotante (AgenteBurbuja); la conversación activa la decide quien lo monta.
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearConversacion, enviarFeedback, ErrorAgente, obtenerConversacion, preguntar,
  type Mensaje, type Respuesta,
} from '../api/agente.api'
import { Bloques } from './Bloques'
import { Markdown } from './Markdown'

const EJEMPLOS = [
  '¿Cómo está Cordón Cuneta en el departamento San Justo?',
  '¿Qué tenemos en Villa María?',
  '¿Cuánto ATP se anunció y cuánto se entregó en Río Cuarto?',
  '¿Qué gestiones de Privada llevan más de 90 días abiertas en Calamuchita?',
]

function fechaCorta(iso: string | null): string {
  if (!iso) return 'sin dato'
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Feedback({ mensajeId }: { mensajeId: string }) {
  const [valor, setValor] = useState<1 | -1 | null>(null)
  const [comentando, setComentando] = useState(false)
  const [comentario, setComentario] = useState('')
  const enviar = (v: 1 | -1, c?: string) => enviarFeedback(mensajeId, v, c).then(() => setValor(v))
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span>¿Te sirvió?</span>
      <button aria-label="Sí" onClick={() => enviar(1)} className={`px-1.5 rounded ${valor === 1 ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-slate-100'}`}>👍</button>
      <button aria-label="No" onClick={() => { setComentando(true); enviar(-1) }} className={`px-1.5 rounded ${valor === -1 ? 'bg-rose-100 text-rose-700' : 'hover:bg-slate-100'}`}>👎</button>
      {comentando && valor === -1 && (
        <form onSubmit={(e) => { e.preventDefault(); enviar(-1, comentario).then(() => setComentando(false)) }} className="flex gap-1">
          <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="¿Qué estuvo mal?"
            className="border border-slate-300 rounded px-2 py-0.5 text-xs w-48" />
          <button className="text-gov-blue">Enviar</button>
        </form>
      )}
    </div>
  )
}

function RespuestaAsistente({ m, onSugerencia, compacto }: { m: Mensaje; onSugerencia: (t: string) => void; compacto: boolean }) {
  const r: Respuesta | null = m.respuesta
  const [verCalculo, setVerCalculo] = useState(false)
  return (
    <div className={`rounded-xl bg-white border border-slate-200 shadow-sm ${compacto ? 'px-3 py-3' : 'px-5 py-4'}`}>
      <Markdown texto={m.texto} />
      {r && <Bloques bloques={r.bloques} />}
      {r && (r.interpretacion || r.sql.length > 0) && (
        <div className="mt-3">
          <button onClick={() => setVerCalculo(!verCalculo)} className="text-xs text-gov-blue hover:underline">
            {verCalculo ? 'Ocultar' : 'Cómo lo calculé'}
          </button>
          {verCalculo && (
            <div className="mt-2 text-xs text-slate-600 space-y-2">
              {r.interpretacion && <p><span className="font-medium">Interpretación:</span> {r.interpretacion}</p>}
              {r.sql.map((s, i) => <pre key={i} className="bg-slate-50 border border-slate-200 rounded p-2 whitespace-pre-wrap">{s}</pre>)}
            </div>
          )}
        </div>
      )}
      {r && r.fuentes.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          Datos al: {r.fuentes.map((f) => `${f.fuente} ${f.estado === 'ok' ? fechaCorta(f.actualizado) : `(${f.estado === 'error' ? 'último dato ' + fechaCorta(f.actualizado) : 'sin datos'})`}`).join(' · ')}
        </p>
      )}
      {r && r.sugerencias.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.sugerencias.map((s) => (
            <button key={s} onClick={() => onSugerencia(s)} className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-gov-cyan/15 text-slate-700 text-left">
              {s}
            </button>
          ))}
        </div>
      )}
      {!r?.error && <div className="mt-3"><Feedback mensajeId={m.id} /></div>}
    </div>
  )
}

interface Props {
  conversacionId: string | null
  /** Se llama apenas se crea la conversación de la primera pregunta. */
  onConversacionCreada: (id: string) => void
  /** Variante angosta para el popup de la burbuja. */
  compacto?: boolean
}

export function ChatAgente({ conversacionId, onConversacionCreada, compacto = false }: Props) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [pendiente, setPendiente] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)

  const detalle = useQuery({
    queryKey: ['agente', 'conversacion', conversacionId],
    queryFn: () => obtenerConversacion(conversacionId!),
    enabled: !!conversacionId,
  })

  const mensajes = conversacionId ? detalle.data?.mensajes ?? [] : []
  // Con llaves: en Chrome actual scrollIntoView devuelve una Promise, y si el efecto la devuelve
  // React la toma como cleanup y falla con "n is not a function".
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [mensajes.length, pendiente, progreso])

  async function enviar(pregunta: string) {
    const t = pregunta.trim()
    if (!t || pendiente) return
    setError(null)
    setPendiente(t)
    setProgreso('Pensando la consulta')
    setTexto('')
    try {
      let id = conversacionId
      if (!id) {
        id = (await crearConversacion()).id
        onConversacionCreada(id)
      }
      await preguntar(id, t, setProgreso)
      await qc.invalidateQueries({ queryKey: ['agente', 'conversacion', id] })
      qc.invalidateQueries({ queryKey: ['agente', 'conversaciones'] })
    } catch (e) {
      const err = e as ErrorAgente
      setError(err.code === 'CUOTA_DIARIA_AGOTADA' ? err.message : `No se pudo completar la consulta. ${err.message ?? ''}`)
      setTexto(t)
    } finally {
      setPendiente(null)
      setProgreso(null)
    }
  }

  return (
    <section className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className={`flex-1 overflow-y-auto space-y-4 ${compacto ? 'px-3 py-3' : 'pr-1'}`}>
        {!conversacionId && !pendiente && (
          <div className={compacto ? 'mt-2' : 'max-w-2xl mx-auto mt-10 text-center'}>
            {!compacto && <h1 className="text-xl font-semibold text-gov-navy">Asistente de consultas</h1>}
            <p className="text-sm text-slate-500 mt-1">
              Preguntá por el estado de los programas, gestiones, montos o demoras de cualquier localidad o departamento.
              Las respuestas salen de los datos del sistema, con la fecha de cada fuente.
            </p>
            <div className={`grid gap-2 mt-4 ${compacto ? '' : 'sm:grid-cols-2 mt-6'}`}>
              {EJEMPLOS.map((e) => (
                <button key={e} onClick={() => enviar(e)} className="text-left text-sm px-4 py-3 rounded-lg border border-slate-200 bg-white hover:border-gov-cyan">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {detalle.isLoading && conversacionId && <p className="text-sm text-slate-500">Cargando…</p>}
        {detalle.isError && conversacionId && <p className="text-sm text-slate-500">No se pudo abrir esta consulta (puede haberse borrado). Empezá una nueva.</p>}
        {mensajes.map((m) =>
          m.rol === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-xl bg-gov-navy text-white px-4 py-2 text-sm whitespace-pre-wrap">{m.texto}</p>
            </div>
          ) : (
            <RespuestaAsistente key={m.id} m={m} onSugerencia={enviar} compacto={compacto} />
          ),
        )}
        {pendiente && (
          <>
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-xl bg-gov-navy text-white px-4 py-2 text-sm whitespace-pre-wrap">{pendiente}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gov-cyan" />
              {progreso}…
            </div>
          </>
        )}
        {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <div ref={finRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(texto) }} className={`flex gap-2 ${compacto ? 'px-3 pt-2' : 'mt-3'}`}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }}
          rows={2}
          maxLength={2000}
          placeholder="Escribí tu consulta…"
          aria-label="Consulta"
          className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:border-gov-cyan"
        />
        <button disabled={!!pendiente || !texto.trim()} className={`rounded-xl bg-gov-cyan text-white font-medium disabled:opacity-50 ${compacto ? 'px-3' : 'px-5'}`}>
          Enviar
        </button>
      </form>
      <p className={`text-[11px] text-slate-400 mt-1 ${compacto ? 'px-3 pb-2' : ''}`}>
        El asistente es de solo consulta y puede equivocarse: revisá "Cómo lo calculé" y el panel de origen antes de usar un dato.
      </p>
    </section>
  )
}
