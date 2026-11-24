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

/** Áreas que habilitan una función y no un panel (ADR-035): no cuentan como "alguna área". */
export const AREAS_DE_FUNCION = ['usuarios']

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
    .filter((a) => a.secretaria === secretaria
      && (areas.length ? areas.includes(a.area) : !AREAS_DE_FUNCION.includes(a.area)))
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

// --- Administración delegada (docs/files/spec-portal-administracion-delegada.md, ADR-035) ---

/** Roles que un administrador delegado puede asignar (el backend valida lo mismo). */
export const ROLES_ASIGNABLES_DELEGADO = ['Supervisor', 'Operador', 'Consulta']

/**
 * Alcance de administración de usuarios: `'*'` para Admin, la secretaría para un Supervisor con
 * el área "usuarios" en Editar, `null` si no administra.
 */
export function alcanceAdminUsuarios(usuario: UsuarioConAreas | null | undefined): string | null {
  if (!usuario) return null
  if (usuario.rol === 'Admin') return '*'
  if (usuario.rol !== 'Supervisor') return null
  const area = (usuario.areas ?? []).find(
    (a) => a.area === 'usuarios' && a.nivel === 'edicion' && usuario.secretarias.includes(a.secretaria),
  )
  return area?.secretaria ?? null
}

/** Catálogos del Checklist Técnico: Admin, o Supervisor con el área Checklist en Editar. */
export function puedeAdministrarCatalogosChecklist(usuario: UsuarioConAreas | null | undefined) {
  if (!usuario) return false
  if (usuario.rol === 'Admin') return true
  return usuario.rol === 'Supervisor' && puedeEditarArea(usuario, 'vivienda', 'checklist')
}

// --- Planificación de programas por localidad (spec-privada-planificacion-programas.md §3, ADR-036) ---

/** Ve la Planificación: Admin, la secretaría Privada con un rol del portal, o Autoridad en solo
 * lectura (spec 1.5.0, sin necesidad de la secretaría Privada). */
export function puedePlanificar(usuario: UsuarioConAreas | null | undefined): boolean {
  if (!usuario) return false
  if (usuario.rol === 'Admin' || usuario.rol === 'Autoridad') return true
  return ['Supervisor', 'Operador', 'Consulta'].includes(usuario.rol) && usuario.secretarias.includes('privada')
}

/** Edita valores de la planilla (autosave por campo). */
export function puedeEditarPlanificacion(usuario: UsuarioConAreas | null | undefined): boolean {
  return puedePlanificar(usuario) && ['Admin', 'Supervisor', 'Operador'].includes(usuario!.rol)
}

/** Configura programas, prioridades, estados y columnas. Borrar un programa: sólo Admin. */
export function puedeConfigurarPlanificacion(usuario: UsuarioConAreas | null | undefined): boolean {
  return puedePlanificar(usuario) && ['Admin', 'Supervisor'].includes(usuario!.rol)
}
