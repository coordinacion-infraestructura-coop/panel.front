// Distancias en línea recta y armado de recorridos (spec-vivienda-tablero-analitico.md §6).
// No es ruteo por calles: el ruteo real se delega a Google Maps con `googleMapsDirUrl`.

export interface Coord {
  lat: number
  lon: number
}

const RADIO_TIERRA_KM = 6371

/** Distancia de círculo máximo entre dos puntos, en km. */
export function haversineKm(a: Coord, b: Coord): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Ordena las paradas por vecino más cercano partiendo de `origen`. Heurística, no óptimo. */
export function ordenarVecinoMasCercano<T extends Coord>(origen: Coord, paradas: T[]): T[] {
  const pendientes = [...paradas]
  const orden: T[] = []
  let actual: Coord = origen
  while (pendientes.length) {
    let mejor = 0
    for (let i = 1; i < pendientes.length; i++) {
      if (haversineKm(actual, pendientes[i]) < haversineKm(actual, pendientes[mejor])) mejor = i
    }
    const [sig] = pendientes.splice(mejor, 1)
    orden.push(sig)
    actual = sig
  }
  return orden
}

/** Km totales de origen → paradas en orden, en línea recta. */
export function kmRecorrido(origen: Coord, paradas: Coord[]): number {
  let total = 0
  let actual = origen
  for (const p of paradas) {
    total += haversineKm(actual, p)
    actual = p
  }
  return total
}

// La URL de direcciones de Google Maps admite un número limitado de paradas intermedias.
export const MAX_WAYPOINTS_GOOGLE = 9

/** URL "Abrir en Google Maps" (API de URLs, sin clave). Sólo viajan coordenadas. */
export function googleMapsDirUrl(origen: Coord, paradas: Coord[]): string {
  const c = (p: Coord) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`
  const usadas = paradas.slice(0, MAX_WAYPOINTS_GOOGLE + 1)
  const destino = usadas[usadas.length - 1]
  const intermedias = usadas.slice(0, -1)
  const params = new URLSearchParams({ api: '1', origin: c(origen), destination: c(destino), travelmode: 'driving' })
  if (intermedias.length) params.set('waypoints', intermedias.map(c).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
