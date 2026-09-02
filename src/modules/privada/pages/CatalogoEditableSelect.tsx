import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogosEditablesApi, type CatalogoNombre, type CatEditable } from '../api/catalogosEditables.api'

interface Props {
  nombre: CatalogoNombre
  label: string
  value: number | null
  onChange: (id: number | null) => void
  /** Admin/Supervisor pueden crear ítems al vuelo. */
  puedeCrear: boolean
}

const NUEVA = '__nueva__'

function extractMsg(e: unknown): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') {
    return (d as { message: string }).message
  }
  return 'No se pudo crear.'
}

/** Desplegable de un catálogo editable (categorías / programas / áreas). La última
 * opción "+ Cargar nueva…" abre un input inline para crear al vuelo (E1 / ADR-010). */
export function CatalogoEditableSelect({ nombre, label, value, onChange, puedeCrear }: Props) {
  const qc = useQueryClient()
  const key = ['privada-cat-edit', nombre]
  const { data: items } = useQuery<CatEditable[]>({
    queryKey: key,
    queryFn: () => catalogosEditablesApi.list(nombre),
    staleTime: 5 * 60 * 1000,
  })

  const [creando, setCreando] = useState(false)
  const [nuevoLabel, setNuevoLabel] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const crear = useMutation({
    mutationFn: () => catalogosEditablesApi.crear(nombre, {
      label: nuevoLabel.trim(),
      orden: ((items?.length ?? 0) + 1) * 10,
    }),
    onSuccess: (nuevo) => {
      qc.setQueryData<CatEditable[]>(key, (prev) =>
        [...(prev ?? []), nuevo].sort((a, b) => a.orden - b.orden || a.label.localeCompare(b.label)))
      onChange(nuevo.id)
      setCreando(false)
      setNuevoLabel('')
      setErr(null)
    },
    onError: (e: unknown) => setErr(extractMsg(e)),
  })

  const inputCls = 'w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan bg-white'

  function cancelar() {
    setCreando(false)
    setNuevoLabel('')
    setErr(null)
  }

  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {!creando ? (
        <select
          className={inputCls}
          value={value ?? ''}
          onChange={(e) => {
            if (e.target.value === NUEVA) { setCreando(true); setErr(null) }
            else onChange(e.target.value ? Number(e.target.value) : null)
          }}
        >
          <option value="">(Sin especificar)</option>
          {(items ?? []).map((it) => (
            <option key={it.id} value={it.id}>{it.label}</option>
          ))}
          {puedeCrear && <option value={NUEVA}>＋ Cargar nueva opción…</option>}
        </select>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={nuevoLabel}
            onChange={(e) => setNuevoLabel(e.target.value)}
            placeholder={`Nueva ${label.toLowerCase()}…`}
            className={inputCls}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (nuevoLabel.trim()) crear.mutate() }
              if (e.key === 'Escape') cancelar()
            }}
          />
          <button type="button" disabled={!nuevoLabel.trim() || crear.isPending}
            onClick={() => crear.mutate()}
            className="shrink-0 text-xs bg-gov-navy text-white px-3 rounded disabled:opacity-50">
            {crear.isPending ? '…' : 'Cargar'}
          </button>
          <button type="button" onClick={cancelar}
            className="shrink-0 text-xs text-slate-500 px-1.5" aria-label="Cancelar">✕</button>
        </div>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}
