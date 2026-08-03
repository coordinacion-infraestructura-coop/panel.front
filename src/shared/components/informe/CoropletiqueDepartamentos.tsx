import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DepartamentoCobertura } from '../../../modules/vivienda/types/vivienda.types'
import { normalizeName } from '../../utils/normalizeName'

// Paletas — mismas que documenta la skill /mapa_coropleth_filtros.
const PALETAS: Record<string, string[]> = {
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
  oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'],
}

const BREAKS_PCT = [0, 1, 15, 30, 45, 60, 75, 90, 100]

function quantileBreaks(values: number[]): number[] {
  const vals = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (!vals.length) return [0, 1]
  const qs = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map(
    (p) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))],
  )
  return [0, ...qs, vals[vals.length - 1]]
}

type Metrica = 'cantidad' | 'pct_cobertura'

export function CoropletiqueDepartamentos({
  data,
  metrica = 'cantidad',
  paleta = 'blues',
  height = 460,
  centerLat = -31.5,
  centerLon = -64.5,
  zoom = 6,
}: {
  data: DepartamentoCobertura[]
  metrica?: Metrica
  paleta?: keyof typeof PALETAS
  height?: number
  centerLat?: number
  centerLon?: number
  zoom?: number
}) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const geoLayerRef = useRef<L.GeoJSON | null>(null)
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/geo/departamentos_cba.json')
      .then((r) => {
        if (!r.ok) throw new Error('no encontrado')
        return r.json()
      })
      .then(setGeoJson)
      .catch(() => setError(true))
  }, [])

  const colors = PALETAS[paleta] ?? PALETAS.blues
  const byDepto = new Map(data.map((d) => [normalizeName(d.departamento), d]))
  const breaks = metrica === 'pct_cobertura' ? BREAKS_PCT : quantileBreaks(data.map((d) => d.cantidad))

  function getColor(value: number): string {
    if (value <= 0) return '#eef2f6'
    for (let i = breaks.length - 2; i >= 0; i--) {
      if (value >= breaks[i]) return colors[Math.min(i, colors.length - 1)]
    }
    return colors[0]
  }

  useEffect(() => {
    if (!mapDivRef.current || !geoJson) return

    if (!mapRef.current) {
      mapRef.current = L.map(mapDivRef.current, { scrollWheelZoom: false }).setView(
        [centerLat, centerLon],
        zoom,
      )
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    geoLayerRef.current?.remove()
    geoLayerRef.current = L.geoJSON(geoJson, {
      style: (feature) => {
        const d = byDepto.get(normalizeName(feature?.properties?.nombre))
        const value = d ? d[metrica] : 0
        return { fillColor: getColor(value), fillOpacity: 0.82, color: '#172c3f', weight: 1 }
      },
      onEachFeature: (feature, layer) => {
        const nombre = feature.properties?.nombre ?? ''
        const d = byDepto.get(normalizeName(nombre))
        const detalle = d
          ? `${d.cantidad} · cobertura ${d.pct_cobertura}% (${d.localidades_cubiertas}/${d.localidades_totales})`
          : 'Sin datos'
        layer.bindTooltip(`<b>${nombre}</b><br/>${detalle}`, { sticky: true })
        layer.on('mouseover', function (this: L.Path) {
          this.setStyle({ fillOpacity: 1, weight: 2, color: '#f7b400' })
          this.bringToFront()
        })
        layer.on('mouseout', function (this: L.Path) {
          geoLayerRef.current?.resetStyle(this)
        })
      },
    }).addTo(mapRef.current)
  }, [geoJson, data, metrica, paleta])

  useEffect(
    () => () => {
      mapRef.current?.remove()
      mapRef.current = null
    },
    [],
  )

  if (error) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No se pudo cargar el mapa de departamentos.
      </div>
    )
  }

  return (
    <div style={{ height, position: 'relative' }}>
      <div ref={mapDivRef} style={{ height: '100%', width: '100%' }} />
      <div className="absolute bottom-3 right-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-2 text-[10px] shadow-md z-[1000]">
        <b className="block text-gov-navy uppercase tracking-wide mb-1">
          {metrica === 'pct_cobertura' ? 'Cobertura %' : 'Cantidad'}
        </b>
        {breaks.slice(0, -1).map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 mb-0.5">
            <span
              className="w-3 h-3 rounded-sm border border-black/10"
              style={{ background: colors[Math.min(i, colors.length - 1)] }}
            />
            <span className="text-gov-navy">
              {Math.round(b)}–{Math.round(breaks[i + 1])}
              {metrica === 'pct_cobertura' ? '%' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
