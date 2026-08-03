import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PuntoInforme } from '../../../modules/vivienda/types/vivienda.types'

// Puerto nativo de la skill /mapa-dual-puntos: clustering en píxeles a zoom
// bajo (radio ∝ √N) + dispersión en círculo de jitter a zoom alto, ambos
// recalculados en cada zoomend. Mismos parámetros por defecto que la skill.
const ZOOM_JITTER = 12
const CLUSTER_PX = 40
const JITTER_PX = 18

interface ClusterMember {
  p: PuntoInforme
  px: L.Point
}

export function MapaDualPuntos({
  puntos,
  height = 460,
  centerLat = -31.5,
  centerLon = -64.5,
  zoom = 6,
}: {
  puntos: PuntoInforme[]
  height?: number
  centerLat?: number
  centerLon?: number
  zoom?: number
}) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [seleccionado, setSeleccionado] = useState<PuntoInforme | null>(null)
  const [visibles, setVisibles] = useState(0)

  const conCoordenadas = puntos.filter((p) => p.lat != null && p.lon != null)

  useEffect(() => {
    if (!mapDivRef.current) return
    const map = L.map(mapDivRef.current, { scrollWheelZoom: false }).setView(
      [centerLat, centerLon],
      zoom,
    )
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer

    function computeClusters(pts: PuntoInforme[], zoomLevel: number) {
      const proyectados: ClusterMember[] = pts.map((p) => ({
        p,
        px: map.project([p.lat as number, p.lon as number], zoomLevel),
      }))
      const clusters: { members: PuntoInforme[]; lat: number; lon: number }[] = []
      const usados = new Set<number>()

      for (let i = 0; i < proyectados.length; i++) {
        if (usados.has(i)) continue
        const seed = proyectados[i]
        const grupo = [seed.p]
        let sumX = seed.px.x
        let sumY = seed.px.y
        usados.add(i)
        for (let j = i + 1; j < proyectados.length; j++) {
          if (usados.has(j)) continue
          const dx = seed.px.x - proyectados[j].px.x
          const dy = seed.px.y - proyectados[j].px.y
          if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_PX) {
            grupo.push(proyectados[j].p)
            sumX += proyectados[j].px.x
            sumY += proyectados[j].px.y
            usados.add(j)
          }
        }
        const centro = map.unproject(
          [sumX / grupo.length, sumY / grupo.length] as [number, number],
          zoomLevel,
        )
        clusters.push({ members: grupo, lat: centro.lat, lon: centro.lng })
      }
      return clusters
    }

    function colorDominante(members: PuntoInforme[]): string {
      const freq = new Map<string, number>()
      members.forEach((p) => {
        const c = p.estado_bg || '#9E9E9E'
        freq.set(c, (freq.get(c) ?? 0) + 1)
      })
      return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }

    function render() {
      layer.clearLayers()
      const zoomActual = map.getZoom()
      const pts = conCoordenadas

      if (zoomActual < ZOOM_JITTER) {
        computeClusters(pts, zoomActual).forEach((cl) => {
          const n = cl.members.length
          const col = colorDominante(cl.members)
          const r = Math.max(5, 4 + Math.sqrt(n) * 2.8)
          const m = L.circleMarker([cl.lat, cl.lon], {
            radius: r,
            color: '#fff',
            weight: 0.8,
            fillColor: col,
            fillOpacity: 0.85,
          }).addTo(layer)
          if (n > 1) m.bindTooltip(`${n} municipios/localidades`, { sticky: true })
          m.on('click', () => map.setView([cl.lat, cl.lon], ZOOM_JITTER))
        })
      } else {
        const grupos = new Map<string, PuntoInforme[]>()
        pts.forEach((p) => {
          const key = `${p.lat},${p.lon}`
          if (!grupos.has(key)) grupos.set(key, [])
          grupos.get(key)!.push(p)
        })
        grupos.forEach((members) => {
          const lat0 = members[0].lat as number
          const lon0 = members[0].lon as number
          const centro = map.latLngToContainerPoint([lat0, lon0])
          members.forEach((p, idx) => {
            let lat = lat0
            let lon = lon0
            if (members.length > 1) {
              const angle = (2 * Math.PI * idx) / members.length
              const px = centro.x + JITTER_PX * Math.cos(angle)
              const py = centro.y + JITTER_PX * Math.sin(angle)
              const ll = map.containerPointToLatLng([px, py])
              lat = ll.lat
              lon = ll.lng
            }
            const m = L.circleMarker([lat, lon], {
              radius: 6,
              color: '#fff',
              weight: 1,
              fillColor: p.estado_bg || '#9E9E9E',
              fillOpacity: 0.9,
            }).addTo(layer)
            m.on('click', () => setSeleccionado(p))
          })
        })
      }
      setVisibles(pts.length)
    }

    render()
    map.on('zoomend', render)

    return () => {
      map.off('zoomend', render)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos])

  return (
    <div style={{ height, position: 'relative' }}>
      <div ref={mapDivRef} style={{ height: '100%', width: '100%' }} />
      <div className="absolute top-3 left-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] shadow-md z-[1000] text-gov-navy">
        <b>{visibles}</b> de {puntos.length} con coordenadas
      </div>
      {seleccionado && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-xl border-t-4 border-gov-cyan max-w-[280px] z-[1000]">
          <div className="flex items-start justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-bold text-gov-navy leading-snug">{seleccionado.nombre}</div>
            <button
              onClick={() => setSeleccionado(null)}
              className="text-gray-400 hover:text-gray-700 text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <table className="w-full text-[11px] px-3.5 py-2">
            <tbody>
              <tr>
                <td className="font-semibold text-gray-500 px-3.5 pt-2 whitespace-nowrap">Depto.</td>
                <td className="pt-2 pr-3.5">{seleccionado.departamento ?? '—'}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-500 px-3.5 whitespace-nowrap">Estado</td>
                <td className="pr-3.5">
                  {seleccionado.estado_label ? (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        background: seleccionado.estado_bg ?? '#e5e7eb',
                        color: seleccionado.estado_text_color ?? '#374151',
                      }}
                    >
                      {seleccionado.estado_label}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-500 px-3.5 whitespace-nowrap">Expediente</td>
                <td className="pr-3.5">{seleccionado.expediente ?? '—'}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-500 px-3.5 pb-2 whitespace-nowrap">Monto</td>
                <td className="pb-2 pr-3.5">
                  {seleccionado.monto != null ? `$${seleccionado.monto.toLocaleString('es-AR')}` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
