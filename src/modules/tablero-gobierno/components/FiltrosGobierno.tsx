import type { LocalidadFiltro } from '../api/tablero.api'

const selectCls =
  'text-sm border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-gov-navy max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan'

interface Props {
  localidades: LocalidadFiltro[]
  anios: number[]
  departamento: string
  localidad: string
  anio: number
  setDepartamento: (dep: string) => void
  setLocalidad: (loc: string, dep: string) => void
  setAnio: (anio: number) => void
}

/** Barra de filtros global del tablero: Departamento · Localidad · Año. */
export function FiltrosGobierno(p: Props) {
  const departamentos = [...new Set(p.localidades.map((l) => l.departamento))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesLoc = p.localidades.filter((l) => !p.departamento || l.departamento === p.departamento)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-gray-500 min-w-0">
        Departamento
        <select className={selectCls} value={p.departamento} onChange={(e) => p.setDepartamento(e.target.value)}>
          <option value="">Toda la provincia</option>
          {departamentos.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-gray-500 min-w-0">
        Localidad
        <select
          className={selectCls}
          value={p.localidad}
          onChange={(e) => {
            const loc = p.localidades.find((l) => l.codigo_indec === e.target.value)
            p.setLocalidad(e.target.value, loc?.departamento ?? p.departamento)
          }}
        >
          <option value="">Todas</option>
          {opcionesLoc.map((l) => (
            <option key={l.codigo_indec} value={l.codigo_indec}>
              {l.nombre}{p.departamento ? '' : ` (${l.departamento})`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-gray-500">
        Año
        <select className={selectCls} value={p.anio} onChange={(e) => p.setAnio(Number(e.target.value))}>
          {p.anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
