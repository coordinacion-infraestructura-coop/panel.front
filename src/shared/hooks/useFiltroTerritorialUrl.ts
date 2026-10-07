import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizeDepartamento, normalizeName } from '../utils/normalizeName'

/** Link directo desde Resumen Territorial: `?departamento=&localidad=` precarga
 * los filtros de un panel (mismo par de query params que ya lee
 * `GestionesListPage`). Se aplica una sola vez, recién cuando cargaron las
 * opciones reales del panel, y se resuelve contra ellas sin tildes ni
 * mayúsculas — los filtros de estos paneles comparan por igualdad exacta y
 * cada fuente escribe los nombres a su manera. Lo que no matchea se ignora
 * (el panel queda sin ese filtro, nunca con una tabla vacía por un valor que
 * no existe en el desplegable). */
export function useFiltroTerritorialUrl({
  departamentos,
  localidades,
  setDepartamento,
  setLocalidad,
}: {
  departamentos: string[]
  localidades: string[]
  setDepartamento: (v: string) => void
  setLocalidad: (v: string) => void
}) {
  const [searchParams] = useSearchParams()
  const aplicado = useRef(false)

  useEffect(() => {
    if (aplicado.current) return
    const dep = searchParams.get('departamento')
    const loc = searchParams.get('localidad')
    if (!dep && !loc) {
      aplicado.current = true
      return
    }
    if (departamentos.length === 0 || localidades.length === 0) return
    aplicado.current = true
    const depReal = dep && departamentos.find((d) => normalizeDepartamento(d) === normalizeDepartamento(dep))
    const locReal = loc && localidades.find((l) => normalizeName(l) === normalizeName(loc))
    if (depReal) setDepartamento(depReal)
    if (locReal) setLocalidad(locReal)
  }, [departamentos.length, localidades.length])  // eslint-disable-line react-hooks/exhaustive-deps
}
