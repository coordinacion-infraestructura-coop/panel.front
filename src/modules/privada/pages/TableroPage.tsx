import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { informeApi, type InformeParams } from '../api/informe.api'
import { KpiStrip, type Kpi } from '../../../shared/components/informe/KpiStrip'
import { DonutChart } from '../../../shared/components/informe/DonutChart'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { LineChart } from '../../../shared/components/informe/LineChart'
import { MapaDualPuntos } from '../../../shared/components/informe/MapaDualPuntos'
import type { PuntoInforme } from '../../vivienda/types/vivienda.types'

// Tablero nativo (ADR-014 / spec-privada-tablero.md) — reemplaza el iframe de
// Looker Studio, que leía BigQuery directo. Sobre los 4 endpoints de agregación
// de svc-privada (informe de Cooperativas).

const DEFAULT_DESDE = '2025-12-01'
const hoyISO = () => new Date().toISOString().slice(0, 10)

const TEMA_COLORS = [
  '#01aae3', '#172c3f', '#398ebd', '#15803d', '#c2410c', '#b91c1c',
  '#7c3aed', '#0891b2', '#ca8a04', '#4d7c0f', '#be123c', '#0f766e',
]

function estadoColor(e?: string | null) {
  const s = (e ?? '').toUpperCase()
  if (s === 'FINALIZADA') return '#15803d'
  if (s === 'ARCHIVADO') return '#64748b'
  if (s === 'INGRESADO') return '#398ebd'
  return '#01aae3'
}

export function TableroPage() {
  const [desde, setDesde] = useState(DEFAULT_DESDE)
  const [hasta, setHasta] = useState(hoyISO())
  const [tema, setTema] = useState('')

  const params: InformeParams = { fecha_desde: desde, fecha_hasta: hasta }
  const paramsTema: InformeParams = { ...params, tema: tema || undefined }

  const resumenQ = useQuery({
    queryKey: ['priv-informe-resumen', desde, hasta],
    queryFn: () => informeApi.resumen(params),
    staleTime: 5 * 60 * 1000,
  })
  const temporalQ = useQuery({
    queryKey: ['priv-informe-temporal', desde, hasta, tema],
    queryFn: () => informeApi.temporal(paramsTema),
    staleTime: 5 * 60 * 1000,
  })
  const deptoQ = useQuery({
    queryKey: ['priv-informe-depto', desde, hasta, tema],
    queryFn: () => informeApi.porDepartamento(paramsTema),
    staleTime: 5 * 60 * 1000,
  })
  const puntosQ = useQuery({
    queryKey: ['priv-informe-puntos', desde, hasta, tema],
    queryFn: () => informeApi.puntos(paramsTema),
    staleTime: 5 * 60 * 1000,
  })

  const porTema = resumenQ.data?.por_tema ?? []

  const kpis: Kpi[] = useMemo(() => [
    { value: resumenQ.data?.total ?? 0, label: 'Gestiones', accent: 'navy' },
    { value: porTema.reduce((a, t) => a + t.en_curso, 0), label: 'En curso', accent: 'cyan' },
    { value: porTema.reduce((a, t) => a + t.finalizadas, 0), label: 'Finalizadas', accent: 'green' },
    { value: porTema.reduce((a, t) => a + t.urgentes, 0), label: 'Urgentes', accent: 'red' },
    { value: porTema.reduce((a, t) => a + t.archivadas, 0), label: 'Archivadas', accent: 'orange' },
  ], [porTema, resumenQ.data])

  const donut = useMemo(() => {
    const rows = [...porTema].sort((a, b) => b.total - a.total)
    return {
      labels: rows.map((r) => r.tema),
      values: rows.map((r) => r.total),
      colors: rows.map((_, i) => TEMA_COLORS[i % TEMA_COLORS.length]),
    }
  }, [porTema])

  const barDepto = useMemo(() => {
    const acc = new Map<string, number>()
    for (const d of deptoQ.data ?? []) {
      const k = d.departamento || '(sin depto)'
      acc.set(k, (acc.get(k) ?? 0) + d.total)
    }
    const rows = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    return { labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]) }
  }, [deptoQ.data])

  const linea = useMemo(() => {
    const acc = new Map<string, number>()
    for (const t of temporalQ.data ?? []) acc.set(t.mes, (acc.get(t.mes) ?? 0) + t.total)
    const rows = [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return { labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]) }
  }, [temporalQ.data])

  const puntos: PuntoInforme[] = useMemo(
    () => (puntosQ.data ?? [])
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        id: p.id_gestion,
        nombre: p.localidad || p.detalle_corto || p.id_gestion,
        departamento: p.departamento,
        lat: p.lat,
        lon: p.lon,
        estado_general_id: null,
        estado_label: p.estado ?? null,
        estado_bg: estadoColor(p.estado),
        estado_text_color: '#ffffff',
        expediente: p.nro_expediente,
        monto: null,
      })),
    [puntosQ.data],
  )

  const temasDisponibles = porTema.map((t) => t.tema)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Tablero de gestiones</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Informe de Cooperativas —{' '}
            {resumenQ.data
              ? `${resumenQ.data.total} gestiones entre ${resumenQ.data.fecha_desde} y ${resumenQ.data.fecha_hasta}`
              : 'cargando…'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-slate-500">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Tema
            <select value={tema} onChange={(e) => setTema(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1.5 text-sm bg-white">
              <option value="">(Todos)</option>
              {temasDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </div>

      {resumenQ.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          No se pudo cargar el informe. Reintentá en unos segundos.
        </div>
      ) : resumenQ.isLoading ? (
        <p className="text-slate-400 text-sm">Cargando informe…</p>
      ) : (
        <div className="space-y-4">
          <KpiStrip items={kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gov-navy mb-3">Gestiones por tema</h3>
              {donut.values.length
                ? <DonutChart labels={donut.labels} values={donut.values} colors={donut.colors} height={300} />
                : <p className="text-xs text-slate-400">Sin datos en el rango.</p>}
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gov-navy mb-3">
                Top departamentos{tema ? ` — ${tema}` : ''}
              </h3>
              {barDepto.values.length
                ? <BarChart labels={barDepto.labels} values={barDepto.values} horizontal height={340} />
                : <p className="text-xs text-slate-400">Sin datos en el rango.</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gov-navy mb-3">
              Evolución mensual (por fecha de ingreso){tema ? ` — ${tema}` : ''}
            </h3>
            {linea.values.length
              ? <LineChart labels={linea.labels} values={linea.values} height={260} />
              : <p className="text-xs text-slate-400">Sin datos en el rango.</p>}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gov-navy mb-3">
              Mapa de gestiones{tema ? ` — ${tema}` : ''}
            </h3>
            {puntos.length
              ? <MapaDualPuntos puntos={puntos} />
              : <p className="text-xs text-slate-400">Sin gestiones georreferenciadas en el rango.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
