import { useId, useMemo } from 'react'
import { SITUACION_OBRA_LABEL, type SituacionObra } from '../avanceObra'
import {
  DOCUMENTACION_LABEL,
  PROGRAMAS,
  claveLocalidad,
  compararEs,
  opciones,
  type Documentacion,
  type Filtros,
} from './expedientes'
import type { ExpedienteTablero, ProgramaTablero } from './tableroAnalitico.api'

export type ModoDistancia = 'localidad' | 'ubicacion'

export interface LocalidadRef {
  clave: string
  label: string
  lat: number
  lon: number
}

/** Localidades con coordenadas del padrón, "LOCALIDAD (DEPTO)", en orden alfabético. */
export function localidadesConCoordenadas(exps: ExpedienteTablero[]): LocalidadRef[] {
  const m = new Map<string, LocalidadRef>()
  for (const e of exps) {
    if (e.lat === null || e.lon === null) continue
    const clave = claveLocalidad(e)
    if (!m.has(clave)) m.set(clave, { clave, label: `${e.localidad}${e.departamento ? ` (${e.departamento})` : ''}`, lat: e.lat, lon: e.lon })
  }
  return [...m.values()].sort((a, b) => compararEs(a.label, b.label))
}

const selectCls =
  'border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gov-cyan min-w-0'

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <p className="sm:w-36 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400 pt-1.5">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-2 flex-1 min-w-0">{children}</div>
    </div>
  )
}

export function FiltrosBar({
  expedientes,
  filtros,
  onChange,
  onLimpiar,
  hayFiltros,
  contador,
  onExportar,
  modoDistancia,
  onModoDistancia,
  refLocalidad,
  onRefLocalidad,
  ubicacionEstado,
  textoDistancia,
}: {
  expedientes: ExpedienteTablero[]
  filtros: Filtros
  onChange: (f: Partial<Filtros>) => void
  onLimpiar: () => void
  hayFiltros: boolean
  contador: number
  onExportar?: () => void
  modoDistancia: ModoDistancia
  onModoDistancia: (m: ModoDistancia) => void
  refLocalidad: string
  onRefLocalidad: (clave: string) => void
  ubicacionEstado: string | null
  textoDistancia: string | null
}) {
  const id = useId()
  const departamentos = useMemo(() => opciones(expedientes, (e) => e.departamento), [expedientes])
  const localidades = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of expedientes) {
      if (filtros.departamento && e.departamento !== filtros.departamento) continue
      m.set(claveLocalidad(e), e.localidad)
    }
    return [...m.entries()].sort((a, b) => compararEs(a[1], b[1]))
  }, [expedientes, filtros.departamento])
  const estadosGenerales = useMemo(() => opciones(expedientes, (e) => e.estado_general_label), [expedientes])
  const juridicos = useMemo(() => opciones(expedientes, (e) => e.subestados?.juridico), [expedientes])
  const tecnicos = useMemo(() => opciones(expedientes, (e) => e.subestados?.tecnico), [expedientes])
  const financieros = useMemo(() => opciones(expedientes, (e) => e.subestados?.financiero), [expedientes])
  const refs = useMemo(() => localidadesConCoordenadas(expedientes), [expedientes])

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-2" aria-label="Filtros">
      <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-100">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gov-navy">
          Filtros
          {hayFiltros && (
            <button onClick={onLimpiar} className="ml-3 normal-case tracking-normal font-normal text-gov-blue hover:underline">
              ✕ Limpiar filtros
            </button>
          )}
        </p>
        {onExportar && (
          <button
            onClick={onExportar}
            className="text-xs font-semibold bg-gov-navy text-white rounded-lg px-3 py-1.5 hover:bg-gov-blue transition-colors"
          >
            Exportar Excel
          </button>
        )}
      </div>

      <Fila titulo="Ubicación">
        <input
          type="search"
          aria-label="Buscar por localidad o departamento"
          placeholder="Buscar por localidad o departamento…"
          value={filtros.texto}
          onChange={(e) => onChange({ texto: e.target.value })}
          className={`${selectCls} flex-1 min-w-[180px]`}
        />
        <select aria-label="Departamento" className={selectCls} value={filtros.departamento}
          onChange={(e) => onChange({ departamento: e.target.value, localidad: '' })}>
          <option value="">Departamento</option>
          {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select aria-label="Localidad" className={`${selectCls} max-w-[260px]`} value={filtros.localidad}
          onChange={(e) => onChange({ localidad: e.target.value })}>
          <option value="">Localidad</option>
          {localidades.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Fila>

      <Fila titulo="Programa">
        <select aria-label="Programa" className={selectCls} value={filtros.programa}
          onChange={(e) => onChange({ programa: e.target.value as ProgramaTablero | '' })}>
          <option value="">Todos los programas</option>
          {PROGRAMAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Fila>

      <Fila titulo="Estados">
        {([
          ['estadoGeneral', 'Estado general', estadosGenerales, 'border-slate-200'],
          ['juridico', 'Est. jurídico', juridicos, 'border-amber-300'],
          ['tecnico', 'Est. técnico', tecnicos, 'border-sky-300'],
          ['financiero', 'Est. financiero', financieros, 'border-emerald-300'],
        ] as const).map(([campo, label, ops, borde]) => (
          <select key={campo} aria-label={label} className={`${selectCls} ${borde} max-w-[280px]`} value={filtros[campo]}
            onChange={(e) => onChange({ [campo]: e.target.value } as Partial<Filtros>)}>
            <option value="">{label}</option>
            {ops.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </Fila>

      <Fila titulo="Documentación / obra">
        <select aria-label="Documentación (checklist)" className={selectCls} value={filtros.documentacion}
          onChange={(e) => onChange({ documentacion: e.target.value as Documentacion | '' })}>
          <option value="">Documentación</option>
          {(Object.keys(DOCUMENTACION_LABEL) as Documentacion[]).map((k) => (
            <option key={k} value={k}>{DOCUMENTACION_LABEL[k]}</option>
          ))}
        </select>
        <select aria-label="Situación de obra" className={selectCls} value={filtros.obra}
          onChange={(e) => onChange({ obra: e.target.value as SituacionObra | '' })}>
          <option value="">Obra</option>
          {(Object.keys(SITUACION_OBRA_LABEL) as SituacionObra[]).map((k) => (
            <option key={k} value={k}>{SITUACION_OBRA_LABEL[k]}</option>
          ))}
        </select>
      </Fila>

      <Fila titulo="Distancia">
        <div className="inline-flex bg-slate-100 border border-slate-200 rounded-lg p-0.5" role="group" aria-label="Origen de la distancia">
          {([['localidad', 'Desde una localidad'], ['ubicacion', 'Desde mi ubicación']] as const).map(([m, l]) => (
            <button key={m} type="button" onClick={() => onModoDistancia(m)} aria-pressed={modoDistancia === m}
              className={`px-2.5 py-1 text-xs rounded-md ${modoDistancia === m ? 'bg-white text-gov-navy shadow-sm font-semibold' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
        {modoDistancia === 'localidad' && (
          <select aria-label="Localidad de referencia" className={`${selectCls} max-w-[300px]`} value={refLocalidad}
            onChange={(e) => onRefLocalidad(e.target.value)}>
            <option value="">Localidad de referencia</option>
            {refs.map((r) => <option key={r.clave} value={r.clave}>{r.label}</option>)}
          </select>
        )}
        <label htmlFor={`${id}-km`} className="sr-only">Distancia máxima en km</label>
        <input id={`${id}-km`} type="number" min={1} inputMode="numeric" placeholder="km" value={filtros.km}
          onChange={(e) => onChange({ km: e.target.value })} className={`${selectCls} w-20`} />
        <p className="text-xs self-center text-gov-blue">
          {textoDistancia ?? ubicacionEstado ?? 'Elegí un origen y una distancia en km'}
        </p>
      </Fila>

      <p className="py-2 text-xs text-gray-500">
        <b className="text-gov-navy">{contador}</b> expedientes
      </p>
    </section>
  )
}
