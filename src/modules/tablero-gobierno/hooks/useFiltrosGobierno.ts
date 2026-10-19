import { useSearchParams } from 'react-router-dom'

/** Filtros globales del tablero en la URL (`?dep=&loc=&anio=`), así una vista filtrada se
 * puede compartir (spec-tablero-gobierno-panel.md §3.2). `loc` es el código INDEC de la
 * localidad del nomenclador de Gobierno: siempre está, aunque falte el id_geo. */
export function useFiltrosGobierno(anioPorDefecto: number) {
  const [params, setParams] = useSearchParams()
  const departamento = params.get('dep') ?? ''
  const localidad = params.get('loc') ?? ''
  const anio = Number(params.get('anio')) || anioPorDefecto

  const actualizar = (cambios: Record<string, string>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(cambios)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true },
    )
  }

  return {
    departamento,
    localidad,
    anio,
    setDepartamento: (dep: string) => actualizar({ dep, loc: '' }),
    setLocalidad: (loc: string, dep: string) => actualizar({ loc, dep }),
    setAnio: (a: number) => actualizar({ anio: a === anioPorDefecto ? '' : String(a) }),
  }
}
