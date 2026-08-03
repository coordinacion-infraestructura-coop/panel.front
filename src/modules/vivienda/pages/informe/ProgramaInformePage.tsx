import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cordonCunetaApi, cordobaHogarApi } from '../../api/vivienda.api'
import type { InformePayload, ProgramaInforme } from '../../types/vivienda.types'
import { KpiStrip, type Kpi } from '../../../../shared/components/informe/KpiStrip'
import { CoropletiqueDepartamentos } from '../../../../shared/components/informe/CoropletiqueDepartamentos'
import { MapaDualPuntos } from '../../../../shared/components/informe/MapaDualPuntos'
import { DonutChart } from '../../../../shared/components/informe/DonutChart'
import { LineChart } from '../../../../shared/components/informe/LineChart'
import { BarChart } from '../../../../shared/components/informe/BarChart'
import { exportToXlsx } from '../../../../shared/utils/exportTable'

function fmtMonto(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('es-AR')
}

function fmtHaceTiempo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const horas = Math.round(min / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: unknown }).message)
  }
  return fallback
}

interface ProgramaConfig {
  titulo: string
  subtitulo: string
  volverA: string
  entidadLabel: string
  paletaCorop: 'blues' | 'greens' | 'oranges'
  api: { getInforme: () => Promise<any>; actualizarInforme: () => Promise<any> }
  extraKpis: (p: InformePayload) => Kpi[]
}

const CONFIG: Record<ProgramaInforme, ProgramaConfig> = {
  cordon_cuneta: {
    titulo: 'Informe — Cordón Cuneta y Adoquinado',
    subtitulo: 'Convenios con municipios — Provincia de Córdoba',
    volverA: '/vivienda/cordon-cuneta',
    entidadLabel: 'Municipios',
    paletaCorop: 'blues',
    api: cordonCunetaApi,
    extraKpis: (p) => [
      { value: fmtNum(p.metricas_extra.cordon_cuneta_ml_total ?? 0), label: 'ML cordón cuneta', accent: 'cyan' },
      { value: fmtNum(p.metricas_extra.adoquinado_m2_total ?? 0), label: 'm² adoquinado', accent: 'orange' },
    ],
  },
  cordoba_hogar: {
    titulo: 'Informe — Córdoba Hogar',
    subtitulo: 'Localidades — Provincia de Córdoba',
    volverA: '/vivienda/cordoba-hogar',
    entidadLabel: 'Localidades',
    paletaCorop: 'greens',
    api: cordobaHogarApi,
    extraKpis: (p) => [
      { value: fmtNum(p.metricas_extra.cantidad_casas_total ?? 0), label: 'Casas', accent: 'cyan' },
      { value: fmtMonto(p.metricas_extra.monto_por_casa ?? 0), label: 'Monto por casa', accent: 'orange' },
    ],
  },
}

export function ProgramaInformePage({ programa }: { programa: ProgramaInforme }) {
  const config = CONFIG[programa]
  const queryClient = useQueryClient()
  const [mapaTab, setMapaTab] = useState<'puntos' | 'coropletico'>('puntos')
  const [error, setError] = useState<string | null>(null)

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['informe', programa],
    queryFn: config.api.getInforme,
    staleTime: Infinity,
  })

  const actualizarMut = useMutation({
    mutationFn: config.api.actualizarInforme,
    onSuccess: (data) => {
      queryClient.setQueryData(['informe', programa], data)
      setError(null)
    },
    onError: (err) => setError(extractErrorMessage(err, 'No se pudo actualizar el informe.')),
  })

  const payload = snapshot?.payload as InformePayload | undefined

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={config.volverA} className="text-xs text-gov-cyan hover:text-gov-navy transition-colors">
            ← Volver al panel
          </Link>
          <h2 className="text-xl font-semibold text-gov-navy mt-1">{config.titulo}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{config.subtitulo}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={() => actualizarMut.mutate()}
            disabled={actualizarMut.isPending}
            className="bg-gov-navy text-white text-sm px-4 py-2 rounded hover:bg-gov-navy/90 transition-colors disabled:opacity-50"
          >
            {actualizarMut.isPending ? 'Calculando…' : '🔄 Actualizar informe'}
          </button>
          {snapshot && (
            <span className="text-[11px] text-gray-400">
              Actualizado {fmtHaceTiempo(snapshot.computed_at)}
              {snapshot.computed_by ? ` por ${snapshot.computed_by}` : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">{error}</div>
      )}

      {isLoading && <div className="text-sm text-gray-400 py-10 text-center">Cargando…</div>}

      {!isLoading && !snapshot && (
        <div className="bg-white rounded-lg border border-slate-200 px-6 py-12 text-center">
          <p className="text-gray-500 text-sm mb-4">
            Todavía no se calculó ningún informe para este programa.
          </p>
          <button
            onClick={() => actualizarMut.mutate()}
            disabled={actualizarMut.isPending}
            className="bg-gov-cyan text-white text-sm px-5 py-2.5 rounded hover:bg-gov-cyan/90 transition-colors disabled:opacity-50"
          >
            {actualizarMut.isPending ? 'Calculando…' : 'Calcular informe ahora'}
          </button>
        </div>
      )}

      {payload && (
        <div className="space-y-6">
          {/* KPIs */}
          <KpiStrip
            items={[
              { value: payload.total_entidades, label: config.entidadLabel },
              { value: fmtMonto(payload.monto_total), label: 'Monto total' },
              { value: payload.departamentos_cubiertos, label: 'Departamentos cubiertos' },
              ...config.extraKpis(payload),
            ]}
          />

          {/* Mapa */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <span className="text-sm font-semibold text-gov-navy">Distribución geográfica</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMapaTab('puntos')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    mapaTab === 'puntos' ? 'bg-gov-navy text-white' : 'bg-slate-100 text-gray-500 hover:bg-slate-200'
                  }`}
                >
                  📍 Por {config.entidadLabel.toLowerCase()}
                </button>
                <button
                  onClick={() => setMapaTab('coropletico')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    mapaTab === 'coropletico' ? 'bg-gov-navy text-white' : 'bg-slate-100 text-gray-500 hover:bg-slate-200'
                  }`}
                >
                  🗺️ Por departamento
                </button>
              </div>
            </div>
            {mapaTab === 'puntos' ? (
              <MapaDualPuntos puntos={payload.puntos} />
            ) : (
              <CoropletiqueDepartamentos data={payload.por_departamento} paleta={config.paletaCorop} />
            )}
          </div>

          {/* Distribución + evolución */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-semibold text-gov-navy mb-3">Por estado general</div>
              <DonutChart
                labels={payload.por_estado_general.map((e) => e.label)}
                values={payload.por_estado_general.map((e) => e.cantidad)}
                colors={payload.por_estado_general.map((e) => e.bg)}
              />
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-semibold text-gov-navy mb-3">Evolución de cambios de estado</div>
              {payload.evolucion_temporal.length ? (
                <LineChart
                  labels={payload.evolucion_temporal.map((e) => e.mes)}
                  values={payload.evolucion_temporal.map((e) => e.cantidad_cambios)}
                />
              ) : (
                <div className="text-sm text-gray-400 text-center py-16">Sin historial de cambios todavía.</div>
              )}
            </div>
          </div>

          {/* Departamentos — ranking + tabla */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gov-navy">
                Cobertura por departamento
              </span>
              <button
                onClick={() =>
                  exportToXlsx(
                    payload.por_departamento.map((d) => ({
                      Departamento: d.departamento,
                      [config.entidadLabel]: d.cantidad,
                      'Localidades cubiertas': d.localidades_cubiertas,
                      'Localidades totales': d.localidades_totales,
                      '% cobertura': d.pct_cobertura,
                    })),
                    'cobertura',
                    `informe_${programa}_departamentos.xlsx`,
                  )
                }
                className="text-xs text-gov-cyan hover:text-gov-navy transition-colors"
              >
                ↓ Exportar
              </button>
            </div>
            <BarChart
              horizontal
              height={Math.max(220, payload.por_departamento.length * 22)}
              labels={payload.por_departamento
                .slice()
                .sort((a, b) => b.cantidad - a.cantidad)
                .map((d) => d.departamento)}
              values={payload.por_departamento
                .slice()
                .sort((a, b) => b.cantidad - a.cantidad)
                .map((d) => d.cantidad)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
