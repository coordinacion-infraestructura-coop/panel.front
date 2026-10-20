import type { LocalidadFiltro } from '../api/tablero.api'

/** Lo que cada pantalla recibe de la barra común: el año y el filtro territorial ya
 * traducido a las dos claves que usan los backends (código INDEC e id_geo). */
export interface ContextoTablero {
  anio: number
  departamento: string
  localidad: LocalidadFiltro | undefined
  /** undefined = toda la provincia */
  codigos: string[] | undefined
  idsGeo: string[] | undefined
  setDepartamento: (dep: string) => void
  irA: (seccion: string, sub?: string) => void
}
