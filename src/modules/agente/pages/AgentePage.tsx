// Agente de consultas para funcionarios (spec-agente-consultas.md §8). Solo Admin y Autoridad.
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { borrarConversacion, listarConversaciones } from '../api/agente.api'
import { ChatAgente } from '../components/ChatAgente'

export function AgentePage() {
  const { conversacionId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const lista = useQuery({ queryKey: ['agente', 'conversaciones'], queryFn: () => listarConversaciones() })
  const borrar = useMutation({
    mutationFn: borrarConversacion,
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['agente', 'conversaciones'] })
      if (id === conversacionId) navigate('/agente')
    },
  })

  return (
    <div className="flex gap-4 h-[calc(100vh-9rem)] min-h-[28rem]">
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => navigate('/agente')} className="m-3 px-3 py-2 rounded-lg bg-gov-navy text-white text-sm hover:brightness-110">
          + Nueva consulta
        </button>
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5" aria-label="Consultas anteriores">
          {lista.data?.items.map((c) => (
            <div key={c.id} className={`group flex items-center rounded-lg ${c.id === conversacionId ? 'bg-gov-cyan/15' : 'hover:bg-slate-100'}`}>
              <button onClick={() => navigate(`/agente/${c.id}`)} className="flex-1 text-left px-3 py-2 text-sm text-slate-700 truncate" title={c.titulo}>
                {c.titulo}
              </button>
              <button onClick={() => borrar.mutate(c.id)} aria-label={`Borrar ${c.titulo}`}
                className="opacity-0 group-hover:opacity-100 px-2 text-slate-400 hover:text-rose-600">×</button>
            </div>
          ))}
        </nav>
      </aside>

      <ChatAgente
        conversacionId={conversacionId ?? null}
        onConversacionCreada={(id) => navigate(`/agente/${id}`, { replace: true })}
      />
    </div>
  )
}
