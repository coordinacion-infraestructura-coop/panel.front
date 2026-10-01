import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { normalizeDepartamento } from '../../utils/normalizeName'

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

// Escala divergente centrada en `centro` (ej. 1.0 para un índice de
// focalización: <1 recibe menos de lo proporcional, >1 recibe más). A
// diferencia de `quantileBreaks` (secuencial, pensada para conteos que
// arrancan en 0), acá lo que importa es la distancia al centro en ambos
// sentidos — spec-resumen-territorial-tablero-v2.md §4 (Etapa 3).
//
// Rojo (<1) a verde oscuro (>1), con blanco en el centro — pedido explícito
// del usuario (2026-10-01). Cada paleta va de MÁS CLARO (cerca del centro,
// ratio≈0) a MÁS OSCURO (lejos del centro, ratio≈1): a mayor distancia de 1,
// color más intenso. "Sin datos" es gris, inconfundible con cualquier punto
// de la escala (ni rojo ni verde pálido).
const DIVERGENTE_ROJO = ['#fee2e2', '#fca5a5', '#ef4444', '#dc2626', '#7f1d1d']
const DIVERGENTE_VERDE = ['#dcfce7', '#86efac', '#22c55e', '#15803d', '#14532d']
const SIN_DATO_COLOR = '#d1d5db'

export function colorDivergente(value: number, centro: number): string {
  if (value === centro) return '#f8fafc'
  const paleta = value < centro ? DIVERGENTE_ROJO : DIVERGENTE_VERDE
  const ratio = Math.min(1, Math.abs(value - centro) / centro)
  const idx = Math.min(paleta.length - 1, Math.floor(ratio * paleta.length))
  return paleta[idx]
}

// Cualquier clave numérica adicional (promedio_programas, gestiones_10k_hab,
// focalizacion_atp, …) puede pasarse en `data` sin tocar este componente —
// sólo hace falta indicarle `metrica` (la clave) y, si corresponde,
// `escala="divergente"`. Genérico en `T` (en vez de una interfaz con index
// signature) para que tipos concretos como `DepartamentoCobertura`, que no
// declaran esa index signature, sigan siendo asignables tal cual.
export interface DatoMapa {
  departamento: string
  [metrica: string]: number | string | null | undefined
}

type Metrica = 'cantidad' | 'pct_cobertura' | (string & {})
type Escala = 'secuencial' | 'divergente'

export function CoropletiqueDepartamentos<T extends { departamento: string }>({
  data,
  metrica = 'cantidad',
  escala = 'secuencial',
  centroDivergente = 1,
  formatValor,
  label,
  seleccionado = null,
  onDepartamentoClick,
  paleta = 'blues',
  height = 460,
  centerLat = -31.5,
  centerLon = -64.5,
  zoom = 6,
}: {
  data: T[]
  metrica?: Metrica
  /** 'divergente' para índices centrados en `centroDivergente` (ej. focalización ATP). */
  escala?: Escala
  centroDivergente?: number
  /** Formato del valor en tooltip/leyenda. Default: entero para secuencial, 2 decimales para divergente. */
  formatValor?: (v: number) => string
  /** Título de la leyenda. Default: "Cobertura %"/"Cantidad" para las métricas legado. */
  label?: string
  /** Departamento normalizado ya elegido en otro filtro — se resalta y hace zoom (filtro bidireccional). */
  seleccionado?: string | null
  /** Clic en un departamento — filtro bidireccional (spec §4, Etapa 3). */
  onDepartamentoClick?: (departamento: string) => void
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
  const byDepto = new Map(data.map((d) => [normalizeDepartamento(d.departamento), d]))
  const fmt = formatValor ?? (escala === 'divergente' ? (v: number) => v.toFixed(2) : (v: number) => String(Math.round(v)))

  function campo(d: T | undefined, clave: string): unknown {
    return d ? (d as unknown as Record<string, unknown>)[clave] : undefined
  }

  function valorDe(d: T | undefined): number | null {
    const raw = campo(d, metrica)
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
  }

  const valoresNumericos = data.map((d) => valorDe(d)).filter((v): v is number => v !== null)
  const breaks =
    escala === 'divergente'
      ? []
      : metrica === 'pct_cobertura'
        ? BREAKS_PCT
        : quantileBreaks(valoresNumericos)

  function getColor(value: number | null): string {
    if (value === null) return SIN_DATO_COLOR
    if (escala === 'divergente') return colorDivergente(value, centroDivergente)
    if (value <= 0) return SIN_DATO_COLOR
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
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        },
      ).addTo(mapRef.current)
    }

    const seleccionadoNorm = seleccionado ? normalizeDepartamento(seleccionado) : null
    let capaSeleccionada: L.Layer | null = null

    geoLayerRef.current?.remove()
    geoLayerRef.current = L.geoJSON(geoJson, {
      style: (feature) => {
        const nombreNorm = normalizeDepartamento(feature?.properties?.nombre)
        const d = byDepto.get(nombreNorm)
        const esSeleccionado = seleccionadoNorm !== null && nombreNorm === seleccionadoNorm
        return {
          fillColor: getColor(valorDe(d)),
          fillOpacity: esSeleccionado ? 1 : 0.82,
          color: esSeleccionado ? '#f7b400' : '#172c3f',
          weight: esSeleccionado ? 3 : 1,
        }
      },
      onEachFeature: (feature, layer) => {
        const nombre = feature.properties?.nombre ?? ''
        const d = byDepto.get(normalizeDepartamento(nombre))
        const valor = valorDe(d)
        const detalle =
          valor === null
            ? 'Sin datos'
            : metrica === 'cantidad' || metrica === 'pct_cobertura'
              ? `${campo(d, 'cantidad')} · cobertura ${campo(d, 'pct_cobertura')}% (${campo(d, 'localidades_cubiertas')}/${campo(d, 'localidades_totales')})`
              : `${label ?? metrica}: ${fmt(valor)}`
        layer.bindTooltip(`<b>${nombre}</b><br/>${detalle}`, { sticky: true })
        layer.on('mouseover', function (this: L.Path) {
          if (normalizeDepartamento(nombre) === seleccionadoNorm) return
          this.setStyle({ fillOpacity: 1, weight: 2, color: '#f7b400' })
          this.bringToFront()
        })
        layer.on('mouseout', function (this: L.Path) {
          if (normalizeDepartamento(nombre) === seleccionadoNorm) return
          geoLayerRef.current?.resetStyle(this)
        })
        if (onDepartamentoClick) {
          layer.on('click', () => onDepartamentoClick(nombre))
          const el = (layer as L.Path).getElement?.() as HTMLElement | undefined
          el?.style.setProperty('cursor', 'pointer')
        }
        if (seleccionadoNorm !== null && normalizeDepartamento(nombre) === seleccionadoNorm) {
          capaSeleccionada = layer
        }
      },
    }).addTo(mapRef.current)

    // Zoom del mapa: al departamento seleccionado, o de vuelta a la vista
    // provincial completa — filtro bidireccional (spec §4). El zoom a punto
    // de una localidad se sacó (feedback QA visual): un choropleth de
    // departamentos no tiene nada útil que mostrar zoomado a nivel calle.
    if (capaSeleccionada) {
      mapRef.current.fitBounds((capaSeleccionada as L.Polygon).getBounds(), { padding: [24, 24], maxZoom: 10 })
    } else {
      mapRef.current.setView([centerLat, centerLon], zoom)
    }
  }, [geoJson, data, metrica, escala, centroDivergente, paleta, seleccionado, onDepartamentoClick])

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
          {label ?? (metrica === 'pct_cobertura' ? 'Cobertura %' : 'Cantidad')}
        </b>
        {escala === 'divergente' ? (
          <>
            {[
              { color: DIVERGENTE_ROJO[DIVERGENTE_ROJO.length - 1], texto: `< ${fmt(centroDivergente)} (menos de lo proporcional)` },
              { color: '#f8fafc', texto: `≈ ${fmt(centroDivergente)} (proporcional)` },
              { color: DIVERGENTE_VERDE[DIVERGENTE_VERDE.length - 1], texto: `> ${fmt(centroDivergente)} (más de lo proporcional)` },
            ].map((row) => (
              <div key={row.texto} className="flex items-center gap-1.5 mb-0.5">
                <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: row.color }} />
                <span className="text-gov-navy">{row.texto}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: SIN_DATO_COLOR }} />
              <span className="text-gov-navy">Sin datos</span>
            </div>
          </>
        ) : (
          breaks.slice(0, -1).map((b, i) => (
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
          ))
        )}
      </div>
    </div>
  )
}
