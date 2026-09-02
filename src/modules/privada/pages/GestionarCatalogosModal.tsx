import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogosEditablesApi, type CatalogoNombre, type CatEditable, type CatEditableIn } from '../api/catalogosEditables.api'

interface Props {
  onClose: () => void
}

const TABS: { nombre: CatalogoNombre; titulo: string }[] = [
  { nombre: 'categorias', titulo: 'Campo de Trabajo' },
  { nombre: 'programas', titulo: 'Programa asociado' },
  { nombre: 'areas', titulo: 'Área' },
]

function msgDe(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') {
    return (d as { message: string }).message
  }
  return fallback
}

const inp = 'border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

function Tabla({ nombre }: { nombre: CatalogoNombre }) {
  const qc = useQueryClient()
  const claves = [['privada-cat-edit-admin', nombre], ['privada-cat-edit', nombre]]
  const invalidar = () => claves.forEach((k) => qc.invalidateQueries({ queryKey: k }))

  const { data: items, isLoading } = useQuery<CatEditable[]>({
    queryKey: ['privada-cat-edit-admin', nombre],
    queryFn: () => catalogosEditablesApi.list(nombre, true),
  })

  const [drafts, setDrafts] = useState<Record<number, Partial<CatEditableIn>>>({})
  const [rowErr, setRowErr] = useState<Record<number, string>>({})
  const [nuevo, setNuevo] = useState<CatEditableIn>({ label: '', orden: 0, bg: '#e2e8f0', text_color: '#1e293b' })
  const [nuevoErr, setNuevoErr] = useState<string | null>(null)

  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CatEditableIn> }) => catalogosEditablesApi.actualizar(nombre, id, data),
    onSuccess: (_r, v) => { invalidar(); setDrafts((p) => { const n = { ...p }; delete n[v.id]; return n }); setRowErr((p) => { const n = { ...p }; delete n[v.id]; return n }) },
    onError: (e, v) => setRowErr((p) => ({ ...p, [v.id]: msgDe(e, 'No se pudo guardar.') })),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => catalogosEditablesApi.eliminar(nombre, id),
    onSuccess: () => invalidar(),
    onError: (e, id) => setRowErr((p) => ({ ...p, [id]: msgDe(e, 'No se pudo eliminar.') })),
  })
  const createMut = useMutation({
    mutationFn: (data: CatEditableIn) => catalogosEditablesApi.crear(nombre, data),
    onSuccess: () => { invalidar(); setNuevo({ label: '', orden: 0, bg: '#e2e8f0', text_color: '#1e293b' }); setNuevoErr(null) },
    onError: (e) => setNuevoErr(msgDe(e, 'No se pudo crear.')),
  })

  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => a.orden - b.orden || a.label.localeCompare(b.label)), [items])
  const esColor = nombre === 'categorias'
  const esPrograma = nombre === 'programas'

  function val<K extends keyof CatEditableIn>(it: CatEditable, k: K): CatEditableIn[K] {
    const d = drafts[it.id]
    return (d && k in d ? d[k] : (it as unknown as CatEditableIn)[k]) as CatEditableIn[K]
  }
  const setDraft = (id: number, k: keyof CatEditableIn, v: unknown) => setDrafts((p) => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const dirty = (id: number) => !!drafts[id] && Object.keys(drafts[id]).length > 0

  if (isLoading) return <p className="text-sm text-slate-400 py-6 text-center">Cargando…</p>

  return (
    <div className="space-y-2">
      {sorted.map((it) => (
        <div key={it.id} className={`border rounded-md ${it.activo ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-70'}`}>
          <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
            {esColor && (
              <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: val(it, 'bg') ?? '#e2e8f0', border: `1px solid ${val(it, 'text_color') ?? '#1e293b'}` }} />
            )}
            <input className={`${inp} flex-1 min-w-[140px]`} value={val(it, 'label') ?? ''} onChange={(e) => setDraft(it.id, 'label', e.target.value)} />
            <input type="number" className={`${inp} w-16`} title="Orden" value={val(it, 'orden') ?? 0} onChange={(e) => setDraft(it.id, 'orden', Number(e.target.value))} />
            {esColor && (
              <>
                <input type="color" className="w-7 h-7 rounded border border-slate-200 cursor-pointer" value={val(it, 'bg') ?? '#e2e8f0'} onChange={(e) => setDraft(it.id, 'bg', e.target.value)} />
                <input type="color" className="w-7 h-7 rounded border border-slate-200 cursor-pointer" value={val(it, 'text_color') ?? '#1e293b'} onChange={(e) => setDraft(it.id, 'text_color', e.target.value)} />
              </>
            )}
            {esPrograma && (
              <input className={`${inp} w-28 font-mono text-xs`} placeholder="código" value={val(it, 'codigo') ?? ''} onChange={(e) => setDraft(it.id, 'codigo', e.target.value || null)} />
            )}
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={val(it, 'activo') ?? true} onChange={(e) => patchMut.mutate({ id: it.id, data: { activo: e.target.checked } })} />
              activo
            </label>
            {it.es_centinela && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">centinela</span>}
            <button type="button" disabled={!dirty(it.id) || patchMut.isPending}
              onClick={() => patchMut.mutate({ id: it.id, data: drafts[it.id] })}
              className="text-xs bg-gov-navy text-white px-2.5 py-1 rounded disabled:opacity-40">Guardar</button>
            <button type="button" disabled={delMut.isPending}
              onClick={() => { setRowErr((p) => { const n = { ...p }; delete n[it.id]; return n }); delMut.mutate(it.id) }}
              className="text-xs text-red-500 hover:text-red-700 px-1.5" title="Eliminar">✕</button>
          </div>
          {rowErr[it.id] && <p className="px-3 pb-2 text-xs text-red-600">{rowErr[it.id]}</p>}
        </div>
      ))}

      {/* Agregar */}
      <div className="border-2 border-dashed border-slate-300 rounded-md px-3 py-2 flex items-center gap-2 flex-wrap">
        <input className={`${inp} flex-1 min-w-[160px]`} placeholder="Nueva opción…" value={nuevo.label}
          onChange={(e) => setNuevo((p) => ({ ...p, label: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter' && nuevo.label.trim()) createMut.mutate(nuevo) }} />
        {esColor && (
          <>
            <input type="color" className="w-7 h-7 rounded border border-slate-200 cursor-pointer" value={nuevo.bg ?? '#e2e8f0'} onChange={(e) => setNuevo((p) => ({ ...p, bg: e.target.value }))} />
            <input type="color" className="w-7 h-7 rounded border border-slate-200 cursor-pointer" value={nuevo.text_color ?? '#1e293b'} onChange={(e) => setNuevo((p) => ({ ...p, text_color: e.target.value }))} />
          </>
        )}
        {esPrograma && (
          <input className={`${inp} w-28 font-mono text-xs`} placeholder="código" value={nuevo.codigo ?? ''} onChange={(e) => setNuevo((p) => ({ ...p, codigo: e.target.value || null }))} />
        )}
        <button type="button" disabled={!nuevo.label.trim() || createMut.isPending}
          onClick={() => createMut.mutate(nuevo)}
          className="text-xs bg-gov-navy text-white px-3 py-1 rounded disabled:opacity-40">
          {createMut.isPending ? '…' : 'Agregar'}
        </button>
      </div>
      {nuevoErr && <p className="text-xs text-red-600">{nuevoErr}</p>}
      <p className="text-[11px] text-slate-400 pt-1">
        Si un ítem está en uso por alguna gestión no se puede borrar (error 409) — desactivalo.
      </p>
    </div>
  )
}

export function GestionarCatalogosModal({ onClose }: Props) {
  const [tab, setTab] = useState<CatalogoNombre>('categorias')

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-60 flex items-start justify-center p-4 overflow-y-auto pointer-events-none"
        role="dialog" aria-modal="true" aria-label="Gestionar catálogos">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 pointer-events-auto">
          <div className="bg-gov-navy text-white px-5 py-4 rounded-t-xl flex items-center justify-between sticky top-0 z-10">
            <h2 className="font-semibold">Gestionar catálogos</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none" aria-label="Cerrar">✕</button>
          </div>
          <div className="px-5 pt-4">
            <div className="inline-flex bg-slate-100 border border-slate-300 rounded-lg p-0.5">
              {TABS.map((t) => (
                <button key={t.nombre} onClick={() => setTab(t.nombre)}
                  className={`px-3 py-1.5 text-sm rounded-md ${tab === t.nombre ? 'bg-white shadow-sm text-gov-navy' : 'text-slate-500'}`}>
                  {t.titulo}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <Tabla key={tab} nombre={tab} />
          </div>
        </div>
      </div>
    </>
  )
}
