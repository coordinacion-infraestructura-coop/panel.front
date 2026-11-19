// Configuración de parámetros por programa (spec-privada-planificacion-programas.md §4, §8):
// programas, prioridades, estados y columnas. Supervisor/Admin; borrar un programa sólo Admin.
// Cada cambio se guarda solo (al salir del campo o al elegir), igual que la planilla.

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AREAS_PROGRAMA,
  FUENTES_PROGRAMA,
  TIPOS_COLUMNA,
  mensajeError,
  planificacionApi,
  type Catalogo,
  type Columna,
  type Estado,
  type Prioridad,
  type Programa,
} from '../../api/planificacion.api'

type Pestania = 'programas' | Catalogo

const PESTANIAS: { id: Pestania; label: string }[] = [
  { id: 'programas', label: 'Programas' },
  { id: 'prioridades', label: 'Prioridades' },
  { id: 'estados', label: 'Estados' },
  { id: 'columnas', label: 'Columnas' },
]

const input = 'text-sm border border-slate-300 rounded px-2 py-1 bg-white'

interface Props {
  programa: Programa | null
  esAdmin: boolean
  onClose: () => void
  onProgramaCreado: (id: number) => void
}

export function ConfiguracionModal({ programa, esAdmin, onClose, onProgramaCreado }: Props) {
  const [tab, setTab] = useState<Pestania>(programa ? 'estados' : 'programas')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mt-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-gov-navy">⚙ Configuración</h3>
            <p className="text-xs text-gray-500">
              {programa ? <>Programa: <strong>{programa.nombre}</strong> · los cambios se guardan solos</> : 'Creá el primer programa'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gov-navy text-xl leading-none">×</button>
        </div>
        <div className="flex gap-1 px-5 pt-3 border-b border-slate-200">
          {PESTANIAS.map((p) => (
            <button
              key={p.id}
              disabled={p.id !== 'programas' && !programa}
              onClick={() => { setTab(p.id); setError(null) }}
              className={`text-sm px-3 py-1.5 rounded-t border-b-2 -mb-px disabled:opacity-30 ${
                tab === p.id ? 'border-gov-cyan text-gov-navy font-semibold' : 'border-transparent text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {error && <div className="mx-5 mt-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{error}</div>}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {tab === 'programas' && (
            <ProgramasTab esAdmin={esAdmin} onError={setError} onProgramaCreado={onProgramaCreado} />
          )}
          {tab !== 'programas' && programa && <CatalogoTab programa={programa} cat={tab} onError={setError} />}
        </div>
      </div>
    </div>
  )
}

// ── Programas ──────────────────────────────────────────────────────────────────

function ProgramasTab({ esAdmin, onError, onProgramaCreado }: { esAdmin: boolean; onError: (m: string | null) => void; onProgramaCreado: (id: number) => void }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['planif', 'programas', 'todos'], queryFn: () => planificacionApi.programas(true) })
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['planif', 'programas'] })
  }
  const editar = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Programa> }) => planificacionApi.editarPrograma(id, body),
    onSuccess: () => { onError(null); refrescar() },
    onError: (e) => onError(mensajeError(e)),
  })
  const borrar = useMutation({
    mutationFn: (id: number) => planificacionApi.borrarPrograma(id),
    onSuccess: () => { onError(null); refrescar() },
    onError: (e) => onError(mensajeError(e)),
  })
  const [nuevo, setNuevo] = useState({ nombre: '', area: 'vivienda', fuente: '' })
  const crear = useMutation({
    mutationFn: () => planificacionApi.crearPrograma({ nombre: nuevo.nombre.trim(), area: nuevo.area, fuente: nuevo.fuente || null }),
    onSuccess: (p) => { onError(null); setNuevo({ nombre: '', area: 'vivienda', fuente: '' }); refrescar(); onProgramaCreado(p.id) },
    onError: (e) => onError(mensajeError(e)),
  })

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Cada programa trae la escala de prioridades 1–5 y X, el estado «Resuelto por ATP» y las columnas
        Anuncio del gobernador, Monto sugerido, Monto firmado y Observación. Vincularlo con un panel existente
        muestra si cada localidad ya está cargada ahí.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase text-gray-400 text-left">
            <th className="py-1">Nombre</th><th>Área</th><th>Panel vinculado</th><th>Orden</th><th>Activo</th><th />
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-1.5 pr-2">
                <input className={`${input} w-full`} defaultValue={p.nombre}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== p.nombre && editar.mutate({ id: p.id, body: { nombre: e.target.value } })} />
              </td>
              <td className="pr-2">
                <select className={input} value={p.area} onChange={(e) => editar.mutate({ id: p.id, body: { area: e.target.value } })}>
                  {AREAS_PROGRAMA.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </td>
              <td className="pr-2">
                <select className={input} value={p.fuente ?? ''} onChange={(e) => editar.mutate({ id: p.id, body: { fuente: e.target.value || null } })}>
                  <option value="">— ninguno —</option>
                  {FUENTES_PROGRAMA.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </td>
              <td className="pr-2">
                <input type="number" className={`${input} w-16`} defaultValue={p.orden}
                  onBlur={(e) => Number(e.target.value) !== p.orden && editar.mutate({ id: p.id, body: { orden: Number(e.target.value) } })} />
              </td>
              <td className="pr-2 text-center">
                <input type="checkbox" checked={p.activo} onChange={(e) => editar.mutate({ id: p.id, body: { activo: e.target.checked } })} />
              </td>
              <td className="text-right">
                {esAdmin && (
                  <button className="text-xs text-red-600 hover:underline"
                    onClick={() => window.confirm(`¿Eliminar el programa «${p.nombre}»? Sus datos dejan de verse.`) && borrar.mutate(p.id)}>
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 items-center bg-slate-50 rounded p-3">
        <input className={`${input} flex-1 min-w-[180px]`} placeholder="Nombre del programa nuevo" value={nuevo.nombre}
          onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <select className={input} value={nuevo.area} onChange={(e) => setNuevo({ ...nuevo, area: e.target.value })}>
          {AREAS_PROGRAMA.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select className={input} value={nuevo.fuente} onChange={(e) => setNuevo({ ...nuevo, fuente: e.target.value })}>
          <option value="">Sin panel vinculado</option>
          {FUENTES_PROGRAMA.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button disabled={!nuevo.nombre.trim() || crear.isPending} onClick={() => crear.mutate()}
          className="text-sm bg-gov-cyan text-white rounded px-3 py-1.5 disabled:opacity-40">
          + Crear programa
        </button>
      </div>
    </div>
  )
}

// ── Prioridades / Estados / Columnas ───────────────────────────────────────────

type Item = Estado | Prioridad | Columna

function CatalogoTab({ programa, cat, onError }: { programa: Programa; cat: Catalogo; onError: (m: string | null) => void }) {
  const qc = useQueryClient()
  const key = ['planif', 'catalogo', programa.id, cat]
  const q = useQuery({ queryKey: key, queryFn: () => planificacionApi.catalogo<Item>(programa.id, cat) })
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['planif', 'catalogo', programa.id] })
    qc.invalidateQueries({ queryKey: ['planif', 'planilla', programa.id] })
  }
  const editar = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => planificacionApi.editarItem(programa.id, cat, id, body),
    onSuccess: () => { onError(null); refrescar() },
    onError: (e) => onError(mensajeError(e)),
  })
  const borrar = useMutation({
    mutationFn: (id: number) => planificacionApi.borrarItem(programa.id, cat, id),
    onSuccess: () => { onError(null); refrescar() },
    onError: (e) => onError(mensajeError(e)),
  })
  const crear = useMutation({
    mutationFn: (body: Record<string, unknown>) => planificacionApi.crearItem(programa.id, cat, body),
    onSuccess: () => { onError(null); refrescar() },
    onError: (e) => onError(mensajeError(e)),
  })

  const items = [...(q.data ?? [])].sort((a, b) => a.orden - b.orden || a.id - b.id)
  const mover = (i: number, d: -1 | 1) => {
    const a = items[i], b = items[i + d]
    if (!a || !b) return
    // Intercambio de orden; si eran iguales, se separan.
    const oa = a.orden === b.orden ? a.orden + d : b.orden
    editar.mutate({ id: a.id, body: { orden: oa } })
    editar.mutate({ id: b.id, body: { orden: a.orden } })
  }

  const ayuda = {
    prioridades: 'La fila toma el color de su estado; si no tiene estado, el de su prioridad. «Excluye» manda la fila al final (p. ej. X = el municipio no quiso el programa).',
    estados: 'El color del estado pinta la fila de la planilla. Al borrar un estado en uso, las filas lo siguen mostrando «(eliminado)» hasta que alguien lo cambie.',
    columnas: 'Columnas editables propias de este programa. El tipo no se puede cambiar si la columna ya tiene datos: creá otra. Ocultarla no borra los datos.',
  }[cat]

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{ayuda}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={it.id} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded px-2 py-1.5">
            <div className="flex flex-col">
              <button className="text-[10px] text-gray-400 hover:text-gov-navy disabled:opacity-20" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
              <button className="text-[10px] text-gray-400 hover:text-gov-navy disabled:opacity-20" disabled={i === items.length - 1} onClick={() => mover(i, 1)}>▼</button>
            </div>
            {cat === 'prioridades' && (
              <input className={`${input} w-14`} defaultValue={(it as Prioridad).codigo} title="Código"
                onBlur={(e) => e.target.value.trim() && e.target.value !== (it as Prioridad).codigo && editar.mutate({ id: it.id, body: { codigo: e.target.value.trim() } })} />
            )}
            <input className={`${input} flex-1 min-w-[160px]`} defaultValue={it.nombre}
              onBlur={(e) => e.target.value.trim() && e.target.value !== it.nombre && editar.mutate({ id: it.id, body: { nombre: e.target.value.trim() } })} />
            {cat !== 'columnas' && <Colores item={it as Estado} onChange={(body) => editar.mutate({ id: it.id, body })} />}
            {cat === 'prioridades' && (
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={(it as Prioridad).excluye} onChange={(e) => editar.mutate({ id: it.id, body: { excluye: e.target.checked } })} />
                Excluye
              </label>
            )}
            {cat === 'columnas' && (
              <ColumnaCampos col={it as Columna} onChange={(body) => editar.mutate({ id: it.id, body })} />
            )}
            <button className="text-xs text-red-600 hover:underline ml-auto"
              onClick={() => window.confirm(`¿Eliminar «${it.nombre}»?`) && borrar.mutate(it.id)}>
              Eliminar
            </button>
          </div>
        ))}
        {items.length === 0 && !q.isLoading && <p className="text-sm text-gray-400">Todavía no hay ítems.</p>}
      </div>
      <NuevoItem cat={cat} siguienteOrden={(items[items.length - 1]?.orden ?? 0) + 1} onCrear={(body) => crear.mutate(body)} pending={crear.isPending} />
    </div>
  )
}

function Colores({ item, onChange }: { item: Estado; onChange: (b: Record<string, unknown>) => void }) {
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      Fondo
      <input type="color" value={item.color_bg ?? '#ffffff'} onChange={(e) => onChange({ color_bg: e.target.value })} className="w-7 h-6 p-0 border-0" />
      Texto
      <input type="color" value={item.color_texto ?? '#172c3f'} onChange={(e) => onChange({ color_texto: e.target.value })} className="w-7 h-6 p-0 border-0" />
      <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: item.color_bg ?? '#fff', color: item.color_texto ?? '#172c3f' }}>
        {item.nombre}
      </span>
    </span>
  )
}

function ColumnaCampos({ col, onChange }: { col: Columna; onChange: (b: Record<string, unknown>) => void }) {
  return (
    <>
      <select className={input} value={col.tipo} onChange={(e) => onChange({ tipo: e.target.value })}>
        {TIPOS_COLUMNA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      {col.tipo === 'lista' && (
        <input className={`${input} min-w-[180px]`} defaultValue={(col.opciones ?? []).join(', ')} title="Opciones separadas por coma"
          onBlur={(e) => onChange({ opciones: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} />
      )}
      <label className="text-xs flex items-center gap-1">
        <input type="checkbox" checked={col.visible} onChange={(e) => onChange({ visible: e.target.checked })} />
        Visible
      </label>
    </>
  )
}

function NuevoItem({ cat, siguienteOrden, onCrear, pending }: { cat: Catalogo; siguienteOrden: number; onCrear: (b: Record<string, unknown>) => void; pending: boolean }) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState('texto')
  const [opciones, setOpciones] = useState('')
  const [bg, setBg] = useState('#E3F2FD')
  const [fg, setFg] = useState('#0D47A1')
  const listo = nombre.trim() && (cat !== 'prioridades' || codigo.trim()) && (tipo !== 'lista' || opciones.trim())
  const enviar = () => {
    const body: Record<string, unknown> = { nombre: nombre.trim(), orden: siguienteOrden }
    if (cat === 'prioridades') body.codigo = codigo.trim()
    if (cat !== 'columnas') { body.color_bg = bg; body.color_texto = fg }
    if (cat === 'columnas') {
      body.tipo = tipo
      if (tipo === 'lista') body.opciones = opciones.split(',').map((o) => o.trim()).filter(Boolean)
    }
    onCrear(body)
    setNombre(''); setCodigo(''); setOpciones('')
  }
  return (
    <div className="flex flex-wrap gap-2 items-center bg-slate-50 rounded p-3">
      {cat === 'prioridades' && <input className={`${input} w-16`} placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} />}
      <input className={`${input} flex-1 min-w-[180px]`} placeholder={cat === 'columnas' ? 'Nombre de la columna nueva' : 'Nombre'} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      {cat !== 'columnas' && (
        <>
          <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} title="Fondo" className="w-7 h-6 p-0 border-0" />
          <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} title="Texto" className="w-7 h-6 p-0 border-0" />
        </>
      )}
      {cat === 'columnas' && (
        <>
          <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_COLUMNA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {tipo === 'lista' && <input className={`${input} min-w-[180px]`} placeholder="Opciones, separadas por coma" value={opciones} onChange={(e) => setOpciones(e.target.value)} />}
        </>
      )}
      <button disabled={!listo || pending} onClick={enviar} className="text-sm bg-gov-cyan text-white rounded px-3 py-1.5 disabled:opacity-40">
        + Agregar
      </button>
    </div>
  )
}
