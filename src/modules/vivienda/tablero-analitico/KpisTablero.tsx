import { CoropletiqueDepartamentos } from '../../../shared/components/informe/CoropletiqueDepartamentos'
import { normalizeDepartamento } from '../../../shared/utils/normalizeName'
import { coberturaPorPrograma, porDepartamento, type FilaExpediente } from './expedientes'
import type { KpisDia } from './tableroAnalitico.api'

export function fmtMontoCorto(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil M`
  if (n >= 1e6) return `$${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  return `$${n.toLocaleString('es-AR')}`
}

function Delta({ actual, previo }: { actual: number; previo: number | null | undefined }) {
  if (previo === null || previo === undefined) return null
  const d = Math.round((actual - previo) * 10) / 10
  if (d === 0) return <span className="text-[10px] text-gray-400" title="Sin cambios contra hace 7 días">= 7 d</span>
  const sube = d > 0
  return (
    <span
      className={`text-[11px] font-semibold ${sube ? 'text-emerald-600' : 'text-rose-600'}`}
      title={`Contra hace 7 días: ${previo.toLocaleString('es-AR')}`}
    >
      {sube ? '↗ +' : '↘ '}
      {d.toLocaleString('es-AR')}
    </span>
  )
}

function Tarjeta({ titulo, children, delta }: { titulo: string; children: React.ReactNode; delta?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
        {delta}
      </div>
      {children}
    </div>
  )
}

function BarraSegmentos({ segmentos, resto }: { segmentos: { label: string; valor: number; color: string }[]; resto?: number }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) + (resto ?? 0)
  if (!total) return <div className="h-7 rounded-lg bg-slate-100" />
  return (
    <div className="flex h-7 rounded-lg overflow-hidden text-[11px] font-semibold text-white" role="img"
      aria-label={segmentos.map((s) => `${s.label}: ${s.valor}`).join(', ')}>
      {segmentos.filter((s) => s.valor > 0).map((s) => (
        <div key={s.label} style={{ width: `${(s.valor / total) * 100}%`, backgroundColor: s.color }}
          className="flex items-center justify-center min-w-[2px] truncate" title={`${s.label}: ${s.valor}`}>
          {s.valor / total > 0.08 ? s.valor : ''}
        </div>
      ))}
      {!!resto && resto > 0 && (
        <div style={{ width: `${(resto / total) * 100}%` }}
          className="flex items-center justify-center bg-slate-200 text-slate-500" title={`Sin programa: ${resto}`}>
          {resto / total > 0.08 ? resto : ''}
        </div>
      )}
    </div>
  )
}

function Leyenda({ items }: { items: { label: string; valor: number | string; color: string }[] }) {
  return (
    <ul className="space-y-0.5 text-[11px] text-gray-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 truncate">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: i.color }} />
            <span className="truncate">{i.label}</span>
          </span>
          <b className="text-gov-navy">{i.valor}</b>
        </li>
      ))}
    </ul>
  )
}

export function KpisTablero({
  rows,
  kpis,
  previo,
  totalLocalidades,
  totalDepartamentos,
}: {
  rows: FilaExpediente[]
  kpis: KpisDia
  /** KPIs de hace 7 días — sólo sin filtros (la serie histórica no está filtrada). */
  previo: KpisDia | null
  totalLocalidades: number
  totalDepartamentos: number
}) {
  const cob = coberturaPorPrograma(rows)
  const pctCom = kpis.programas_activos ? kpis.comunicaciones_30d / kpis.programas_activos : 0

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
      <Tarjeta titulo="Localidades" delta={<Delta actual={kpis.localidades} previo={previo?.localidades} />}>
        <p className="text-3xl font-extrabold text-gov-navy leading-none">
          {kpis.localidades} <span className="text-sm font-normal text-gray-400">de {totalLocalidades}</span>
        </p>
        <BarraSegmentos
          segmentos={cob.map((c) => ({ label: c.label, valor: c.localidades, color: c.color }))}
          resto={Math.max(0, totalLocalidades - kpis.localidades)}
        />
        <Leyenda items={cob.map((c) => ({ label: c.label, valor: c.localidades, color: c.color }))} />
      </Tarjeta>

      <Tarjeta titulo="Departamentos" delta={<Delta actual={kpis.departamentos} previo={previo?.departamentos} />}>
        <p className="text-3xl font-extrabold text-gov-navy leading-none">
          {kpis.departamentos} <span className="text-sm font-normal text-gray-400">de {totalDepartamentos}</span>
        </p>
        <BarraSegmentos
          segmentos={cob.map((c) => ({ label: c.label, valor: c.departamentos, color: c.color }))}
          resto={Math.max(0, totalDepartamentos - kpis.departamentos)}
        />
        <Leyenda items={cob.map((c) => ({ label: c.label, valor: c.departamentos, color: c.color }))} />
      </Tarjeta>

      <Tarjeta titulo="Con ítems faltantes" delta={<Delta actual={kpis.items_faltantes} previo={previo?.items_faltantes} />}>
        <p className="text-3xl font-extrabold text-rose-600 leading-none">
          {kpis.items_faltantes} <span className="text-sm font-normal text-gray-400">de {kpis.programas_activos}</span>
        </p>
        <div className="flex items-end gap-2 h-20" role="img" aria-label="Expedientes con ítems faltantes por programa">
          {cob.map((c) => {
            const alto = c.expedientes ? (c.conFaltantes / c.expedientes) * 100 : 0
            return (
              <div key={c.id} className="flex-1 flex flex-col items-center gap-0.5" title={`${c.label}: ${c.conFaltantes} de ${c.expedientes}`}>
                <span className="text-[10px] font-semibold text-gov-navy">{c.conFaltantes}</span>
                <div className="w-full rounded-t bg-slate-100 h-14 flex items-end">
                  <div className="w-full rounded-t" style={{ height: `${alto}%`, backgroundColor: c.color }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400">Barra = % del programa con documentación faltante</p>
      </Tarjeta>

      <Tarjeta titulo="Comunicaciones · 30 días" delta={<Delta actual={kpis.comunicaciones_30d} previo={previo?.comunicaciones_30d} />}>
        <div className="flex items-center gap-3">
          <div
            className="h-20 w-20 rounded-full flex-shrink-0 grid place-items-center"
            style={{ background: `conic-gradient(#22c55e ${pctCom * 360}deg, #e2e8f0 0deg)` }}
            role="img" aria-label={`${kpis.comunicaciones_30d} de ${kpis.programas_activos} con comunicación`}
          >
            <div className="h-14 w-14 rounded-full bg-white grid place-items-center">
              <span className="text-lg font-extrabold text-emerald-600">{kpis.comunicaciones_30d}</span>
            </div>
          </div>
          <Leyenda items={[
            { label: 'Con comunicación', valor: kpis.comunicaciones_30d, color: '#22c55e' },
            { label: 'Sin comunicación', valor: kpis.programas_activos - kpis.comunicaciones_30d, color: '#e2e8f0' },
          ]} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Expedientes activos" delta={<Delta actual={kpis.programas_activos} previo={previo?.programas_activos} />}>
        <p className="text-3xl font-extrabold text-gov-blue leading-none">{kpis.programas_activos}</p>
        <BarraSegmentos segmentos={cob.map((c) => ({ label: c.label, valor: c.expedientes, color: c.color }))} />
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-gray-400 uppercase text-[10px]">Monto total</p>
            <b className="text-gov-navy">{fmtMontoCorto(kpis.monto_total)}</b>
          </div>
          <div>
            <p className="text-gray-400 uppercase text-[10px]">Avance obra prom.</p>
            <b className="text-gov-navy">{kpis.avance_obra_promedio === null ? '—' : `${kpis.avance_obra_promedio}%`}</b>
          </div>
        </div>
      </Tarjeta>
    </div>
  )
}

export function DepartamentosPanel({
  rows,
  seleccionado,
  onSeleccionar,
}: {
  rows: FilaExpediente[]
  seleccionado: string
  onSeleccionar: (departamento: string) => void
}) {
  const datos = porDepartamento(rows)
  const top = (clave: 'cantidad' | 'comunicaciones') =>
    [...datos].sort((a, b) => b[clave] - a[clave] || a.departamento.localeCompare(b.departamento, 'es')).slice(0, 5)
  const maxCant = Math.max(1, ...datos.map((d) => d.cantidad))
  const maxCom = Math.max(1, ...datos.map((d) => d.comunicaciones))

  return (
    <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Mapa de calor · expedientes por departamento
        </p>
        <CoropletiqueDepartamentos
          data={datos}
          metrica="cantidad"
          label="Expedientes"
          paleta="oranges"
          seleccionado={seleccionado || null}
          onDepartamentoClick={(d) => {
            const real = datos.find((x) => normalizeDepartamento(x.departamento) === normalizeDepartamento(d))?.departamento ?? d
            onSeleccionar(real === seleccionado ? '' : real)
          }}
          height={380}
        />
        <p className="text-[11px] text-gray-400 mt-1">Clic en un departamento para filtrar; otro clic lo quita.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">Ranking · departamentos</p>
        {([
          ['Con más expedientes', top('cantidad'), 'cantidad', maxCant, 'bg-indigo-400'],
          ['Con más comunicaciones (30 d)', top('comunicaciones'), 'comunicaciones', maxCom, 'bg-emerald-400'],
        ] as const).map(([titulo, lista, clave, max, color]) => (
          <div key={titulo} className="mb-4 last:mb-0">
            <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">{titulo}</p>
            <ul className="space-y-1.5">
              {lista.map((d) => (
                <li key={d.departamento}>
                  <button type="button" onClick={() => onSeleccionar(d.departamento)} className="w-full text-left group">
                    <span className="flex justify-between text-xs text-gov-navy group-hover:underline">
                      <span className="truncate">{d.departamento}</span>
                      <b>{d[clave]}</b>
                    </span>
                    <span className="block h-1.5 rounded bg-slate-100">
                      <span className={`block h-1.5 rounded ${color}`} style={{ width: `${(d[clave] / max) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
