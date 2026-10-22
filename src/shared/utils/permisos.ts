// Áreas de acceso por secretaría (docs/files/spec-portal-areas-de-acceso.md). Replica en el
// cliente la regla de `app/auth.py` (`nivel_de_area`) para armar menús y botones; el backend
// sigue siendo el que responde 403.

export type NivelArea = 'lectura' | 'edicion'

export interface AreaAcceso {
  secretaria: string
  area: string
  nivel: NivelArea
}

interface UsuarioConAreas {
  rol: string
  secretarias: string[]
  areas?: AreaAcceso[]
}

/** Mejor nivel del usuario en alguna de `areas` de la secretaría (cualquiera si va vacío). */
export function nivelDeArea(
  usuario: UsuarioConAreas | null | undefined,
  secretaria: string,
  areas: string[] = [],
): NivelArea | null {
  if (!usuario) return null
  if (usuario.rol === 'Admin') return 'edicion'
  if (!usuario.secretarias.includes(secretaria)) return null
  const niveles = (usuario.areas ?? [])
    .filter((a) => a.secretaria === secretaria && (areas.length === 0 || areas.includes(a.area)))
    .map((a) => a.nivel)
  if (niveles.includes('edicion')) return 'edicion'
  return niveles.length ? 'lectura' : null
}

export function puedeEditarArea(usuario: UsuarioConAreas | null | undefined, secretaria: string, area: string) {
  return nivelDeArea(usuario, secretaria, [area]) === 'edicion'
}

/** Área que exige cada pantalla. `areas: []` = cualquier área de la secretaría. */
export interface AreaRequerida {
  secretaria: string
  areas: string[]
  abiertoAAutoridad?: boolean
}

export const AREA_DE_RUTA: Record<string, AreaRequerida> = {
  '/vivienda/programas': { secretaria: 'vivienda', areas: [], abiertoAAutoridad: true },
  '/vivienda/tablero-analitico': { secretaria: 'vivienda', areas: [], abiertoAAutoridad: true },
  '/vivienda/cordon-cuneta': { secretaria: 'vivienda', areas: ['cc'] },
  '/vivienda/cordoba-hogar': { secretaria: 'vivienda', areas: ['ch'] },
  '/vivienda/mi-lugar': { secretaria: 'vivienda', areas: ['ml'] },
  '/vivienda/checklist-tecnico': { secretaria: 'vivienda', areas: ['checklist'] },
}

export function cumpleArea(usuario: UsuarioConAreas | null | undefined, req: AreaRequerida) {
  if (req.abiertoAAutoridad && usuario?.rol === 'Autoridad') return true
  return nivelDeArea(usuario, req.secretaria, req.areas) !== null
}

/** Las rutas sin área en `AREA_DE_RUTA` (secretarías que todavía no tienen áreas) quedan como antes. */
export function puedeVerRuta(usuario: UsuarioConAreas | null | undefined, ruta: string) {
  const req = AREA_DE_RUTA[ruta]
  return req ? cumpleArea(usuario, req) : true
}
