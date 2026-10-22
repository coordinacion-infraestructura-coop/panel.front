// Estados de los paneles CC / CH / ML: un listado por área (docs/files/spec-vivienda-estados-por-area.md).
// Cada estado pertenece a un solo listado (`dimension`). El editor de abajo reemplaza a los tres
// administradores de estados que tenía cada panel; los paneles solo le pasan su API.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AreaBadge, AreaResponsableSelect } from './areaEstado'
import { useEstadosTecnico } from './estadoTecnico'
import type { AreaResponsable, DimensionEditable, DimensionEstado } from './types/vivienda.types'

export interface EstadoDePanel {
  id: number
  label: string
  bg: string
  text_color: string
  orden: number
  dimension: DimensionEstado
  area_responsable?: AreaResponsable | null
}

export interface EstadoDePanelCreate {
  label: string
  bg: string
  text_color: string
  orden: number
  dimension: DimensionEditable
  area_responsable?: AreaResponsable | null
}

export type EstadoDePanelUpdate = Partial<Omit<EstadoDePanelCreate, 'dimension'>>

// Columna de la entidad → listado del que toma sus valores.
export const DIMENSION_DE_CAMPO = {
  ejuridico: 'juridico',
  efinanciero: 'financiero',
  estado_general: 'general',
} as const satisfies Record<string, DimensionEditable>

/** Estados de un listado, ordenados como en el administrador. */
export function estadosDe<T extends EstadoDePanel>(estados: T[], dimension: DimensionEstado): T[] {
  return estados.filter((e) => e.dimension === dimension).sort((a, b) => a.orden - b.orden)
}

/** Aporte de un estado al % de avance, de 0 a 1: su posición dentro de su propio listado. */
export function avanceEnListado(id: number | null | undefined, estados: EstadoDePanel[], dimension: DimensionEstado) {
  const listado = estadosDe(estados, dimension)
  const i = listado.findIndex((e) => e.id === id)
  if (i < 0 || listado.length < 2) return 0
  return i / (listado.length - 1)
}

type Pestaña = DimensionEditable | 'tecnico'

const PESTAÑAS: { key: Pestaña; label: string }[] = [
  { key: 'juridico', label: 'Jurídico' },
  { key: 'financiero', label: 'Presupuestario' },
  { key: 'general', label: 'General' },
  { key: 'tecnico', label: 'Técnico' },
]

function mensajeDeError(err: unknown, fallback: string) {
  if ((err as { response?: { status?: number } })?.response?.status === 403) {
    return 'No tenés permisos para realizar esta acción.'
  }
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  const message = (detail as { message?: unknown } | undefined)?.message
  return typeof message === 'string' ? message : fallback
}

const inp = 'border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan'

function CamposEstado<T extends EstadoDePanelUpdate>({
  form, setForm,
}: { form: T; setForm: (f: (p: T) => T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etiqueta</label>
        <input className={`w-full ${inp}`} value={form.label ?? ''} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Ej: Escritura firmada" />
      </div>
      {(['bg', 'text_color'] as const).map((campo) => (
        <div key={campo}>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{campo === 'bg' ? 'Color fondo' : 'Color texto'}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form[campo] ?? '#e2e8f0'} onChange={(e) => setForm((p) => ({ ...p, [campo]: e.target.value }))} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
            <input className={`flex-1 ${inp} font-mono text-xs`} value={form[campo] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [campo]: e.target.value }))} />
          </div>
        </div>
      ))}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orden</label>
        <input type="number" className={`w-full ${inp}`} value={form.orden ?? ''} onChange={(e) => setForm((p) => ({ ...p, orden: Number(e.target.value) }))} />
      </div>
      <div className="flex items-end">
        <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold" style={{ background: form.bg ?? '#e2e8f0', color: form.text_color ?? '#1e293b' }}>{form.label || 'Vista previa'}</span>
      </div>
      <div className="col-span-2">
        <AreaResponsableSelect value={form.area_responsable} onChange={(v) => setForm((p) => ({ ...p, area_responsable: v }))} />
      </div>
    </div>
  )
}

function ListadoTecnico({ esAdmin }: { esAdmin: boolean }) {
  const estados = useEstadosTecnico()
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
        Es el "Estado del expediente" del Checklist Técnico: un solo listado para Cordón Cuneta,
        Córdoba Hogar y Mi Lugar. Se administra desde los catálogos del Checklist
        {esAdmin
          ? <> (<Link to="/admin/catalogos-checklist" className="text-gov-blue underline">ir a catálogos</Link>).</>
          : <>, solo Admin.</>}
      </p>
      {estados.map((e) => (
        <div key={e.id} className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-md bg-slate-50">
          <span className="flex-1 text-sm font-medium">{e.label}</span>
          {!e.en_ruta && <span className="text-[10px] text-gray-500">fuera de la ruta</span>}
          {!e.activo && <span className="text-[10px] text-gray-400">inactivo</span>}
        </div>
      ))}
    </div>
  )
}

/**
 * Administrador de estados de un panel, con un selector por listado. Crear y editar: Operador,
 * Supervisor y Admin; borrar: Supervisor y Admin (`canDelete`). `extra` se suma al alta (Mi Lugar
 * manda su `tipo`).
 */
export function EstadosPorAreaEditor<E extends EstadoDePanel>({
  estados, api, onInvalidate, canDelete, esAdmin, extra,
}: {
  estados: E[]
  api: {
    create: (data: EstadoDePanelCreate & Record<string, unknown>) => Promise<unknown>
    update: (id: number, data: EstadoDePanelUpdate) => Promise<unknown>
    remove: (id: number) => Promise<unknown>
  }
  onInvalidate: () => void
  canDelete: boolean
  esAdmin: boolean
  extra?: Record<string, unknown>
}) {
  const [pestaña, setPestaña] = useState<Pestaña>('juridico')
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EstadoDePanelUpdate>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<Record<number, string>>({})
  const [showNew, setShowNew] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const listado = pestaña === 'tecnico' ? [] : estadosDe(estados, pestaña)
  const formVacio = (): EstadoDePanelUpdate => ({
    label: '', bg: '#e2e8f0', text_color: '#1e293b', orden: (listado[listado.length - 1]?.orden ?? 0) + 10, area_responsable: null,
  })
  const [newForm, setNewForm] = useState<EstadoDePanelUpdate>(formVacio)

  const elegir = (p: Pestaña) => {
    setPestaña(p); setEditId(null); setShowNew(false); setCreateError(null); setEditError(null)
  }

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EstadoDePanelUpdate }) => api.update(id, data),
    onSuccess: () => { onInvalidate(); setEditId(null); setEditError(null) },
    onError: (err: unknown) => setEditError(mensajeDeError(err, 'Error al guardar los cambios del estado.')),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: () => onInvalidate(),
    onError: (err: unknown, id: number) => setDeleteError((p) => ({ ...p, [id]: mensajeDeError(err, 'Error al eliminar el estado.') })),
  })
  const createMut = useMutation({
    mutationFn: (data: EstadoDePanelCreate & Record<string, unknown>) => api.create(data),
    onSuccess: () => { onInvalidate(); setShowNew(false); setCreateError(null) },
    onError: (err: unknown) => setCreateError(mensajeDeError(err, 'Error al crear el estado.')),
  })

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Listado de estados" className="inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-50">
        {PESTAÑAS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={pestaña === key}
            onClick={() => elegir(key)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              pestaña === key ? 'bg-white text-gov-navy shadow-sm' : 'text-gray-500 hover:text-gov-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {pestaña === 'tecnico' ? <ListadoTecnico esAdmin={esAdmin} /> : (
        <div className="space-y-2">
          {listado.length === 0 && <p className="text-xs text-gray-400">Este listado no tiene estados todavía.</p>}
          {listado.map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-md overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50">
                <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: e.bg, border: `1px solid ${e.text_color}` }} />
                <span className="flex-1 text-sm font-medium">{e.label}</span>
                <span className="text-xs text-gray-400 w-10 text-right">{e.orden}</span>
                <AreaBadge area={e.area_responsable} />
                <button
                  onClick={() => {
                    setEditId(editId === e.id ? null : e.id); setEditError(null)
                    setEditForm({ label: e.label, bg: e.bg, text_color: e.text_color, orden: e.orden, area_responsable: e.area_responsable ?? null })
                  }}
                  className="p-1 text-gray-400 hover:text-gov-navy rounded transition-colors" title="Editar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                {canDelete && (
                  <button
                    onClick={() => { setDeleteError((p) => { const n = { ...p }; delete n[e.id]; return n }); deleteMut.mutate(e.id) }}
                    disabled={deleteMut.isPending}
                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Eliminar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
              {deleteError[e.id] && <p className="px-3 py-1.5 text-xs text-red-600 bg-red-50 border-t border-red-200">{deleteError[e.id]}</p>}
              {editId === e.id && (
                <div className="px-3 py-3 border-t border-slate-200 bg-white space-y-3">
                  <CamposEstado form={editForm} setForm={setEditForm} />
                  {editError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{editError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditId(null); setEditError(null) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button onClick={() => updateMut.mutate({ id: e.id, data: editForm })} disabled={updateMut.isPending || !editForm.label?.trim()} className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-colors" style={{ background: 'var(--color-gov-navy)' }}>
                      {updateMut.isPending ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="border-2 border-dashed border-slate-300 rounded-md overflow-hidden">
            {!showNew ? (
              <button onClick={() => { setNewForm(formVacio()); setShowNew(true); setCreateError(null) }} className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gov-navy hover:bg-slate-50 transition-colors">
                + Nuevo estado {PESTAÑAS.find((p) => p.key === pestaña)?.label.toLowerCase()}
              </button>
            ) : (
              <div className="px-3 py-3 space-y-3">
                <CamposEstado form={newForm} setForm={setNewForm} />
                {createError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{createError}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => { setShowNew(false); setCreateError(null) }} className="px-3 py-1.5 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button
                    onClick={() => createMut.mutate({ ...(newForm as Omit<EstadoDePanelCreate, 'dimension'>), dimension: pestaña, ...extra })}
                    disabled={createMut.isPending || !newForm.label?.trim()}
                    className="px-4 py-1.5 text-xs text-white rounded disabled:opacity-50 hover:opacity-90 transition-colors" style={{ background: 'var(--color-gov-navy)' }}
                  >
                    {createMut.isPending ? 'Guardando...' : 'Crear estado'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
