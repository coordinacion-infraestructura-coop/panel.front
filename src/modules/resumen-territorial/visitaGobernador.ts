// "Visita del gobernador" (E5g, spec-resumen-territorial-ficha-localidad.md): la única fuente es
// la planilla "2. RECORRIDO Y VISITAS" (pestaña Visitas Gober) de Gobierno, que llega en
// `visita_gobernador` del snapshot vía svc-datos-externos. Antes se infería de "tener ATP", lo
// que dejaba afuera a 88 localidades visitadas (análisis de coherencia del 2026-11-19).

export interface VisitaGobernador {
  visitada: boolean
  fecha_ultima: string | null
}

interface ConVisita {
  visita_gobernador?: VisitaGobernador | null
  programas?: { area: string }[]
}

/**
 * `true`/`false` según la planilla de visitas; `null` si la localidad no figura en ella (sin
 * dato: no se puede afirmar ni sí ni no). Un snapshot calculado antes del deploy de E5g no trae
 * el campo (`undefined`): ahí, y sólo ahí, se usa el criterio viejo (tener ATP).
 */
export function visitoGobernador(loc: ConVisita | null | undefined): boolean | null {
  if (!loc) return null
  if (loc.visita_gobernador !== undefined) return loc.visita_gobernador ? loc.visita_gobernador.visitada : null
  return (loc.programas ?? []).some((p) => p.area === 'gralgob')
}
