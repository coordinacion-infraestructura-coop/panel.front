// Burbuja flotante del asistente (spec-agente-consultas.md §8): fija abajo a la izquierda en todo
// el portal, abre el chat en un popup. Solo Admin y Autoridad; no se muestra en /agente.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChatAgente } from './ChatAgente'

const CLAVE = 'agente-burbuja-conversacion'

function leerGuardada(): string | null {
  try { return sessionStorage.getItem(CLAVE) } catch { return null }
}

function guardar(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CLAVE, id)
    else sessionStorage.removeItem(CLAVE)
  } catch { /* sin storage: la conversación dura lo que la pestaña */ }
}

export function AgenteBurbuja() {
  const { pathname } = useLocation()
  const [abierta, setAbierta] = useState(false)
  // El chat queda montado después de la primera apertura: cerrar el popup no corta una consulta en curso.
  const [montada, setMontada] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | null>(leerGuardada)

  useEffect(() => {
    if (!abierta) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierta])

  if (pathname.startsWith('/agente')) return null

  const cambiarConversacion = (id: string | null) => {
    setConversacionId(id)
    guardar(id)
  }

  return (
    <>
      {montada && (
        <div
          role="dialog"
          aria-label="Asistente de consultas"
          className={`${abierta ? 'flex' : 'hidden'} fixed z-[1100] bottom-20 left-4 right-4 sm:right-auto sm:w-[26rem] h-[min(38rem,calc(100vh-7rem))] flex-col rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl overflow-hidden`}
        >
          <header className="flex items-center gap-2 bg-gov-navy text-white px-4 py-2.5">
            <p className="flex-1 text-sm font-semibold">Asistente de consultas</p>
            <button onClick={() => cambiarConversacion(null)} className="text-xs text-white/80 hover:text-white px-1.5" title="Empezar una consulta nueva">
              Nueva
            </button>
            <Link
              to={conversacionId ? `/agente/${conversacionId}` : '/agente'}
              onClick={() => setAbierta(false)}
              className="text-xs text-white/80 hover:text-white px-1.5"
              title="Abrir en pantalla completa, con el historial"
            >
              Ampliar
            </Link>
            <button onClick={() => setAbierta(false)} aria-label="Cerrar asistente" className="text-lg leading-none text-white/80 hover:text-white px-1.5">×</button>
          </header>
          <ChatAgente conversacionId={conversacionId} onConversacionCreada={cambiarConversacion} compacto />
        </div>
      )}

      <button
        onClick={() => { setMontada(true); setAbierta(!abierta) }}
        aria-label={abierta ? 'Cerrar asistente de consultas' : 'Abrir asistente de consultas'}
        aria-expanded={abierta}
        title="Asistente de consultas"
        className="fixed z-[1100] bottom-4 left-4 h-14 w-14 rounded-full bg-gov-cyan text-white shadow-lg hover:brightness-110 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-navy"
      >
        {abierta ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
            <path strokeLinecap="round" d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" strokeWidth={2.4} />
          </svg>
        )}
      </button>
    </>
  )
}
