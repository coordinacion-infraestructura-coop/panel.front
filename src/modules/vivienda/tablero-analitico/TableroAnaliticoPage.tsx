// Tablero analítico de Vivienda — réplica del tablero que el área armó en base44, pero en vivo
// sobre db_vivienda (ADR-030). Spec: docs/files/spec-vivienda-tablero-analitico.md §5–§7.
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportToXlsx } from '../../../shared/utils/exportTable'
import type { Coord } from '../../../shared/utils/geo'
import { obraColumnasExcel } from '../avanceObra'
import {
  FILTROS_VACIOS,
  agruparPorLocalidad,
  aplicarFiltros,
  hayFiltros as calcularHayFiltros,
  kpisDe,
  puntoHace,
  textoChecklist,
  type Filtros,
  type GrupoLocalidad,
} from './expedientes'
import { FiltrosBar, localidadesConCoordenadas, type ModoDistancia } from './FiltrosBar'
import { DepartamentosPanel, KpisTablero } from './KpisTablero'
import { MapaTablero, type Parada } from './MapaTablero'
import { TablaExpedientes } from './TablaExpedientes'
import { TendenciasTablero } from './TendenciasTablero'
import { tableroAnaliticoApi } from './tableroAnalitico.api'

type Pestania = 'tablero' | 'mapa' | 'tendencias'
const PESTANIAS: { id: Pestania; label: string }[] = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'mapa', label: 'Mapa y recorrido' },
  { id: 'tendencias', label: 'Tendencias' },
]
const DIAS_DELTA = 7

export function TableroAnaliticoPage() {
  const [pestania, setPestania] = useState<Pestania>('tablero')
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [modoDistancia, setModoDistancia] = useState<ModoDistancia>('localidad')
  const [refLocalidad, setRefLocalidad] = useState('')
  const [miUbicacion, setMiUbicacion] = useState<Coord | null>(null)
  const [ubicacionEstado, setUbicacionEstado] = useState<string | null>(null)
  const [recorrido, setRecorrido] = useState<Parada[]>([])
  const [dias, setDias] = useState(90)

  const { data, isLoading, isError, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['vivienda', 'tablero-analitico'],
    queryFn: tableroAnaliticoApi.get,
  })
  // El delta de 7 días necesita al menos 8 días de serie, aunque el rango elegido sea menor.
  const { data: serie = [], isLoading: cargandoSerie } = useQuery({
    queryKey: ['vivienda', 'tablero-analitico', 'tendencias', Math.max(dias, 30)],
    queryFn: () => tableroAnaliticoApi.tendencias(Math.max(dias, 30)),
  })

  const expedientes = useMemo(() => data?.expedientes ?? [], [data])
  const refs = useMemo(() => localidadesConCoordenadas(expedientes), [expedientes])
  const refSel = refs.find((r) => r.clave === refLocalidad) ?? null
  const origen: Coord | null = modoDistancia === 'ubicacion' ? miUbicacion : refSel
  const origenLabel = modoDistancia === 'ubicacion' ? (miUbicacion ? 'mi ubicación' : null) : refSel?.label ?? null
  const km = Number(filtros.km)
  const distanciaActiva = !!origen && km > 0

  const filas = useMemo(() => aplicarFiltros(expedientes, filtros, origen), [expedientes, filtros, origen])
  const grupos = useMemo(() => agruparPorLocalidad(filas, distanciaActiva), [filas, distanciaActiva])
  const kpis = useMemo(() => kpisDe(filas), [filas])
  const conFiltros = calcularHayFiltros(filtros, origen)
  const previo = conFiltros ? null : puntoHace(serie, DIAS_DELTA)?.kpis ?? null
  const serieRango = useMemo(() => {
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
    return serie.filter((p) => p.fecha >= desde)
  }, [serie, dias])

  const onChange = useCallback((f: Partial<Filtros>) => setFiltros((prev) => ({ ...prev, ...f })), [])

  function elegirModo(m: ModoDistancia) {
    setModoDistancia(m)
    if (m !== 'ubicacion' || miUbicacion) return
    if (!('geolocation' in navigator)) {
      setUbicacionEstado('Este navegador no permite obtener la ubicación.')
      return
    }
    setUbicacionEstado('Obteniendo tu ubicación…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMiUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setUbicacionEstado(null)
      },
      () => setUbicacionEstado('No se pudo obtener tu ubicación: revisá el permiso del navegador.'),
      { enableHighAccuracy: false, timeout: 15_000 },
    )
  }

  function toggleParada(g: GrupoLocalidad) {
    if (g.lat === null || g.lon === null) return
    setRecorrido((prev) =>
      prev.some((p) => p.clave === g.clave)
        ? prev.filter((p) => p.clave !== g.clave)
        : [...prev, { clave: g.clave, label: `${g.localidad}${g.departamento ? ` (${g.departamento})` : ''}`, lat: g.lat as number, lon: g.lon as number }],
    )
  }

  function exportar() {
    const rows = grupos.flatMap((g) =>
      g.expedientes.map((e) => ({
        Localidad: e.localidad,
        Departamento: e.departamento ?? '',
        ...(distanciaActiva ? { 'Distancia (km)': e.distanciaKm === null ? '' : Math.round(e.distanciaKm * 10) / 10 } : {}),
        Programa: e.programa_label,
        Detalle: e.detalle ?? '',
        Expediente: e.expediente ?? '',
        'Estado general': e.estado_general_label ?? '',
        'Est. jurídico': e.subestados?.juridico ?? '',
        'Est. técnico': e.subestados?.tecnico ?? '',
        'Est. financiero': e.subestados?.financiero ?? '',
        Checklist: textoChecklist(e),
        'Documentación faltante': e.checklist_faltantes.join('; '),
        'Última comunicación': e.ultima_comunicacion?.fecha ?? '',
        'Texto última comunicación': e.ultima_comunicacion?.texto ?? '',
        Monto: e.monto ?? '',
        ...obraColumnasExcel(e),
      })),
    )
    exportToXlsx(rows, 'Tablero analítico', `tablero_analitico_vivienda_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const textoDistancia = distanciaActiva && origenLabel ? `Dentro de ${km} km desde ${origenLabel}` : null
  const sinCoordenadas = filas.filter((e) => e.lat === null).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gov-cyan">Secretaría de Vivienda</p>
          <h1 className="text-xl font-bold text-gov-navy">Tablero analítico</h1>
          <p className="text-xs text-gray-400">
            Cordón Cuneta, Córdoba Hogar y Mi Lugar, en vivo.
            {dataUpdatedAt > 0 && ` Datos al ${new Date(dataUpdatedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}.`}
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="ml-2 text-gov-blue hover:underline disabled:opacity-50">
              {isFetching ? 'Actualizando…' : 'Actualizar'}
            </button>
          </p>
        </div>
        <nav className="inline-flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm" aria-label="Vistas del tablero">
          {PESTANIAS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPestania(p.id)} aria-current={pestania === p.id ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm rounded-lg ${pestania === p.id ? 'bg-gov-navy text-white' : 'text-gray-600 hover:text-gov-navy'}`}>
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando expedientes…</p>
      ) : isError || !data ? (
        <p className="text-sm text-rose-600">No se pudo cargar el tablero. Probá de nuevo en unos minutos.</p>
      ) : (
        <>
          {pestania !== 'tendencias' && (
            <FiltrosBar
              expedientes={expedientes}
              filtros={filtros}
              onChange={onChange}
              onLimpiar={() => { setFiltros(FILTROS_VACIOS); setRefLocalidad('') }}
              hayFiltros={conFiltros}
              contador={filas.length}
              onExportar={exportar}
              modoDistancia={modoDistancia}
              onModoDistancia={elegirModo}
              refLocalidad={refLocalidad}
              onRefLocalidad={setRefLocalidad}
              ubicacionEstado={modoDistancia === 'ubicacion' ? ubicacionEstado : null}
              textoDistancia={textoDistancia}
            />
          )}

          {pestania === 'tablero' && (
            <>
              <KpisTablero
                rows={filas}
                kpis={kpis}
                previo={previo}
                totalLocalidades={data.total_localidades_padron}
                totalDepartamentos={Object.keys(data.total_localidades_por_departamento).length}
              />
              <DepartamentosPanel rows={filas} seleccionado={filtros.departamento}
                onSeleccionar={(d) => onChange({ departamento: d, localidad: '' })} />
              <TablaExpedientes
                grupos={grupos}
                conDistancia={distanciaActiva}
                enRecorrido={new Set(recorrido.map((p) => p.clave))}
                onToggleRecorrido={toggleParada}
              />
            </>
          )}

          {pestania === 'mapa' && (
            <MapaTablero
              grupos={grupos}
              sinCoordenadas={sinCoordenadas}
              origen={origen}
              origenLabel={origenLabel}
              radioKm={distanciaActiva ? km : null}
              recorrido={recorrido}
              onToggleParada={toggleParada}
              onRecorrido={setRecorrido}
            />
          )}

          {pestania === 'tendencias' && (
            <TendenciasTablero serie={serieRango} cargando={cargandoSerie} dias={dias} onDias={setDias} />
          )}
        </>
      )}
    </div>
  )
}
