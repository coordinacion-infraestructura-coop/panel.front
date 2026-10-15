import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MAX_WAYPOINTS_GOOGLE,
  googleMapsDirUrl,
  kmRecorrido,
  ordenarVecinoMasCercano,
  type Coord,
} from '../../../shared/utils/geo'
import { COLOR_PROGRAMA, PROGRAMAS, type GrupoLocalidad } from './expedientes'
import { fmtMontoCorto } from './KpisTablero'

export interface Parada extends Coord {
  clave: string
  label: string
}

const COLOR_MULTIPROGRAMA = '#172c3f'

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export function MapaTablero({
  grupos,
  sinCoordenadas,
  origen,
  origenLabel,
  radioKm,
  recorrido,
  onToggleParada,
  onRecorrido,
}: {
  grupos: GrupoLocalidad[]
  sinCoordenadas: number
  origen: Coord | null
  origenLabel: string | null
  radioKm: number | null
  recorrido: Parada[]
  onToggleParada: (g: GrupoLocalidad) => void
  onRecorrido: (paradas: Parada[]) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const capaRef = useRef<L.LayerGroup | null>(null)
  const toggleRef = useRef(onToggleParada)
  toggleRef.current = onToggleParada

  useEffect(() => {
    if (!divRef.current) return
    const map = L.map(divRef.current, { scrollWheelZoom: true }).setView([-31.4, -64.2], 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)
    capaRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const conCoord = grupos.filter((g) => g.lat !== null && g.lon !== null)
  const enRecorrido = new Set(recorrido.map((p) => p.clave))

  useEffect(() => {
    const map = mapRef.current
    const capa = capaRef.current
    if (!map || !capa) return
    capa.clearLayers()

    const montos = conCoord.map((g) => g.expedientes.reduce((s, e) => s + (e.monto ?? 0), 0))
    const maxMonto = Math.max(1, ...montos)

    if (origen && radioKm) {
      L.circle([origen.lat, origen.lon], {
        radius: radioKm * 1000, color: '#01aae3', weight: 1, fillOpacity: 0.06,
      }).addTo(capa)
    }
    if (origen) {
      L.circleMarker([origen.lat, origen.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#e11d48', fillOpacity: 1 })
        .bindTooltip(`Origen: ${origenLabel ?? 'mi ubicación'}`)
        .addTo(capa)
    }

    conCoord.forEach((g, i) => {
      const programas = [...new Set(g.expedientes.map((e) => e.programa))]
      const color = programas.length === 1 ? COLOR_PROGRAMA[programas[0]] : COLOR_MULTIPROGRAMA
      const radio = 5 + 13 * Math.sqrt(montos[i] / maxMonto)
      const marcado = enRecorrido.has(g.clave)
      const porPrograma = PROGRAMAS.map((p) => [p, g.expedientes.filter((e) => e.programa === p.id).length] as const)
        .filter(([, n]) => n > 0)
        .map(([p, n]) => `<li><span style="color:${p.color}">●</span> ${escapar(p.label)}: ${n}</li>`)
        .join('')
      const html = `
        <div style="min-width:180px">
          <b style="color:#172c3f">${escapar(g.localidad)}</b><br/>
          <span style="font-size:11px;color:#64748b;text-transform:uppercase">${escapar(g.departamento ?? '')}</span>
          <p style="margin:4px 0 2px;font-size:12px"><b>${g.expedientes.length}</b> expediente${g.expedientes.length === 1 ? '' : 's'}
          · Inversión: <b>${fmtMontoCorto(montos[i])}</b>
          ${g.distanciaKm !== null ? `<br/>A ${g.distanciaKm.toFixed(1)} km del origen` : ''}</p>
          <ul style="margin:0;padding:0;list-style:none;font-size:12px">${porPrograma}</ul>
          <button data-parada="${escapar(g.clave)}" style="margin-top:6px;font-size:11px;border:1px solid #01aae3;border-radius:4px;padding:2px 6px;background:${marcado ? '#01aae31a' : '#fff'};cursor:pointer">
            ${marcado ? '✓ Quitar del recorrido' : '+ Agregar al recorrido'}
          </button>
        </div>`
      const m = L.circleMarker([g.lat as number, g.lon as number], {
        radius: radio,
        color: marcado ? '#e11d48' : '#fff',
        weight: marcado ? 3 : 1,
        fillColor: color,
        fillOpacity: 0.75,
      }).bindPopup(html)
      m.on('popupopen', (ev) => {
        const btn = (ev.popup.getElement() as HTMLElement | undefined)?.querySelector('button[data-parada]')
        btn?.addEventListener('click', () => {
          toggleRef.current(g)
          m.closePopup()
        })
      })
      m.addTo(capa)
    })

    if (recorrido.length) {
      const puntos: L.LatLngExpression[] = [
        ...(origen ? [[origen.lat, origen.lon] as L.LatLngTuple] : []),
        ...recorrido.map((p) => [p.lat, p.lon] as L.LatLngTuple),
      ]
      L.polyline(puntos, { color: '#e11d48', weight: 2, dashArray: '6 6' }).addTo(capa)
      recorrido.forEach((p, i) => {
        L.marker([p.lat, p.lon], {
          icon: L.divIcon({
            className: '',
            html: `<span style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:9px;background:#e11d48;color:#fff;font-size:10px;font-weight:700">${i + 1}</span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 22],
          }),
          interactive: false,
        }).addTo(capa)
      })
    }
  }, [grupos, origen, radioKm, recorrido, origenLabel])

  // Encuadre: al cambiar los filtros, ajusta el mapa a los puntos visibles.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !conCoord.length) return
    const bounds = L.latLngBounds(conCoord.map((g) => [g.lat as number, g.lon as number] as L.LatLngTuple))
    if (origen) bounds.extend([origen.lat, origen.lon])
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 })
  }, [grupos, origen])

  const inicio: Coord | null = origen ?? recorrido[0] ?? null
  const paradasDesdeInicio = origen ? recorrido : recorrido.slice(1)
  const km = inicio ? kmRecorrido(inicio, paradasDesdeInicio) : 0
  const mover = (i: number, d: -1 | 1) => {
    const n = [...recorrido]
    const j = i + d
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]
    onRecorrido(n)
  }

  return (
    <div className="grid gap-3 grid-cols-1 lg:grid-cols-[1fr_300px]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-100 text-xs">
          <p className="text-gray-500">
            <b className="text-gov-navy">{conCoord.length}</b> localidades en mapa
            {sinCoordenadas > 0 && (
              <span className="text-amber-600"> · {sinCoordenadas} expedientes sin coordenadas (sin vínculo al padrón)</span>
            )}
          </p>
          <ul className="flex flex-wrap gap-3 text-gray-600">
            {PROGRAMAS.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label}
              </li>
            ))}
            <li className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_MULTIPROGRAMA }} />
              Varios programas
            </li>
            <li className="text-gray-400">Tamaño = inversión</li>
          </ul>
        </div>
        <div ref={divRef} style={{ height: 560 }} />
      </div>

      <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3" aria-label="Recorrido">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gov-navy">Armar recorrido</p>
          <p className="text-[11px] text-gray-400">
            Agregá localidades desde el mapa o la tabla.{' '}
            {origen ? `Sale desde ${origenLabel ?? 'tu ubicación'}.` : 'Sin origen elegido, sale desde la primera parada.'}
          </p>
        </div>
        {recorrido.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Todavía no hay paradas.</p>
        ) : (
          <>
            <ol className="space-y-1 text-xs max-h-[320px] overflow-y-auto">
              {recorrido.map((p, i) => (
                <li key={p.clave} className="flex items-center gap-1.5">
                  <span className="h-5 w-5 flex-shrink-0 rounded-full bg-rose-600 text-white text-[10px] font-bold grid place-items-center">{i + 1}</span>
                  <span className="flex-1 truncate" title={p.label}>{p.label}</span>
                  <button type="button" aria-label={`Subir ${p.label}`} onClick={() => mover(i, -1)} className="px-1 text-gray-400 hover:text-gov-navy">↑</button>
                  <button type="button" aria-label={`Bajar ${p.label}`} onClick={() => mover(i, 1)} className="px-1 text-gray-400 hover:text-gov-navy">↓</button>
                  <button type="button" aria-label={`Quitar ${p.label}`} onClick={() => onRecorrido(recorrido.filter((x) => x.clave !== p.clave))} className="px-1 text-gray-400 hover:text-rose-600">✕</button>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-600">
              Total en línea recta: <b className="text-gov-navy">{km.toLocaleString('es-AR', { maximumFractionDigits: 0 })} km</b>
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button"
                onClick={() => inicio && onRecorrido(origen ? ordenarVecinoMasCercano(origen, recorrido) : [recorrido[0], ...ordenarVecinoMasCercano(recorrido[0], recorrido.slice(1))])}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-gov-cyan">
                Ordenar por cercanía
              </button>
              <button type="button" onClick={() => onRecorrido([])}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-rose-400">
                Vaciar
              </button>
            </div>
            {inicio && paradasDesdeInicio.length > 0 && (
              <a href={googleMapsDirUrl(inicio, paradasDesdeInicio)} target="_blank" rel="noopener noreferrer"
                className="text-center text-xs font-semibold bg-gov-navy text-white rounded-lg px-3 py-2 hover:bg-gov-blue">
                Abrir en Google Maps ↗
              </a>
            )}
            {paradasDesdeInicio.length > MAX_WAYPOINTS_GOOGLE + 1 && (
              <p className="text-[11px] text-amber-600">
                Google Maps admite hasta {MAX_WAYPOINTS_GOOGLE + 1} paradas por enlace: se abren las primeras.
              </p>
            )}
            <p className="text-[10px] text-gray-400">Al abrir Google Maps sólo se envían las coordenadas de las localidades.</p>
          </>
        )}
      </aside>
    </div>
  )
}
