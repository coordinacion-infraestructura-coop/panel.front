import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { BarChart } from '../../../shared/components/informe/BarChart'
import { tableroApi, type FfedEtapa, type FfedLocalidad } from '../api/tablero.api'
import {
  Aviso, Cargando, EstadoFondo, Fuente, Kpi, Kpis, Panel, SelectorAnio, Tabla, Velocimetro, colorEstadoFondo, type Columna,
} from '../components/Bloques'
import { MESES, fmtFecha, fmtMonto, fmtN, fmtPct, fmtPeriodo } from '../formato'
import type { ContextoTablero } from './contexto'

// Filtro de la tabla por localidad: un estado de etapa (franja de estados) o uno de los atajos.
type Filtro = { tipo: 'estado'; estado: string } | { tipo: 'rendicion' } | { tipo: 'pendientes' } | null

const PENDIENTES = new Set(['DISPONIBLE', 'LISTO PARA PAGAR', 'PEDIDO OBSERVADO', 'REMANENTE DISPONIBLE'])

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function textoPendientes(l: FfedLocalidad): string {
  return l.pendientes.map((p) => `${p.etapa} (${capital(p.estado)})`).join(', ')
}

function aplica(l: FfedLocalidad, f: Filtro): boolean {
  if (!f) return true
  if (f.tipo === 'rendicion') return l.debe_rendicion
  if (f.tipo === 'pendientes') return l.adherida && l.pendientes.length > 0
  return l.etapas.some((e) => e.estado === f.estado)
}

function columnasEtapas(verObs: boolean): Columna<FfedEtapa>[] {
  return [
    { titulo: 'Etapa', valor: (e) => e.etapa, render: (e) => <span className={e.es_extra ? 'text-sky-800' : 'font-semibold'}>{e.etapa}</span> },
    { titulo: 'Estado', valor: (e) => e.estado, render: (e) => <EstadoFondo estado={e.estado} /> },
    { titulo: 'Monto etapa', valor: (e) => e.monto_etapa, render: (e) => fmtMonto(e.monto_etapa), numerica: true },
    { titulo: 'Disponible', valor: (e) => e.disponible_etapa, render: (e) => fmtMonto(e.disponible_etapa), numerica: true },
    { titulo: 'Otorgado', valor: (e) => e.otorgado, render: (e) => fmtMonto(e.otorgado), numerica: true },
    { titulo: 'Entrega', valor: (e) => e.fecha_entrega, render: (e) => fmtFecha(e.fecha_entrega) },
    { titulo: 'Cuota mensual', valor: (e) => e.cuota, render: (e) => fmtMonto(e.cuota), numerica: true },
    { titulo: 'Plazo', valor: (e) => e.plazo, render: (e) => (e.plazo ? `${e.plazo} meses` : '—'), numerica: true },
    { titulo: 'Descuento desde', valor: (e) => e.inicio_descuento, render: (e) => fmtFecha(e.inicio_descuento) },
    { titulo: 'Cuotas devueltas', valor: (e) => e.cuotas_devueltas, numerica: true },
    { titulo: 'Devuelto', valor: (e) => e.devuelto, render: (e) => fmtMonto(e.devuelto), numerica: true },
    { titulo: 'Saldo a devolver', valor: (e) => e.saldo, render: (e) => fmtMonto(e.saldo), numerica: true },
    {
      titulo: 'Destino',
      valor: (e) => [e.destino, e.destino_detalle].filter(Boolean).join(' — ') || null,
      render: (e) => (
        <span className="inline-block max-w-[260px] truncate align-bottom" title={e.destino_detalle ?? ''}>
          {e.destino ?? '—'}
        </span>
      ),
    },
    { titulo: 'Sticker rendición', valor: (e) => e.sticker_rendicion },
    { titulo: 'Resolución', valor: (e) => e.resolucion },
    {
      titulo: 'Observación',
      valor: (e) => (verObs ? [e.observaciones, e.aviso_texto].filter(Boolean).join(' · ') || null : e.tiene_observacion ? 'Sí' : null),
      render: (e) =>
        !e.tiene_observacion ? (
          '—'
        ) : verObs ? (
          <span className="inline-block max-w-[340px] whitespace-normal text-amber-800" title={e.aviso_texto ?? ''}>
            {e.observaciones ?? e.aviso_texto}
            {e.fecha_aviso && <span className="text-gray-500"> · avisado el {fmtFecha(e.fecha_aviso)}</span>}
          </span>
        ) : (
          <span className="text-amber-800">Sí{e.fecha_aviso ? ` · avisado el ${fmtFecha(e.fecha_aviso)}` : ''}</span>
        ),
    },
  ]
}

/** Fondo Federal (Etapa 3b): planilla "0. Fondo Federal" del área. Por localidad: en qué etapa
 * está, qué cobró, qué tiene pendiente, el estado de la última etapa y si debe rendiciones
 * (spec-datos-externos-fase3b-fondo-federal.md §4). */
export function FondoFederalVista({ ctx }: { ctx: ContextoTablero }) {
  const [anio, setAnio] = useState<number | 'gestion'>('gestion')
  const [filtro, setFiltro] = useState<Filtro>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const detalleRef = useRef<HTMLDivElement>(null)
  const q = useQuery({ queryKey: ['tablero-gobierno', 'fondo-federal', ctx.codigos], queryFn: () => tableroApi.fondoFederal(ctx.anio, ctx.codigos) })

  const colLocalidades = useMemo<Columna<FfedLocalidad>[]>(
    () => [
      { titulo: 'Departamento', valor: (l) => l.departamento },
      { titulo: 'Localidad', valor: (l) => l.localidad },
      { titulo: 'Tipo', valor: (l) => l.tipo },
      { titulo: 'Última etapa', valor: (l) => l.ultima_etapa, numerica: true },
      { titulo: 'Estado de la última', valor: (l) => l.estado_ultima_etapa, render: (l) => <EstadoFondo estado={l.estado_ultima_etapa} /> },
      { titulo: 'Última cobrada', valor: (l) => l.ultima_etapa_cobrada ?? (l.adherida ? 'Ninguna' : 'No adherida'), numerica: true },
      { titulo: 'Pendientes', valor: (l) => textoPendientes(l) || null, render: (l) => (l.pendientes.length ? <span className="text-sky-800">{textoPendientes(l)}</span> : '—') },
      {
        titulo: 'Debe rendición',
        valor: (l) => (l.debe_rendicion ? `Sí: ${l.sin_rendir.join(', ')}` : 'No'),
        render: (l) => (l.debe_rendicion ? <span className="font-semibold text-amber-700">Sí · etapa {l.sin_rendir.join(', ')}</span> : 'No'),
      },
      { titulo: 'Otorgado', valor: (l) => l.otorgado, render: (l) => fmtMonto(l.otorgado), numerica: true },
      { titulo: 'Saldo a devolver', valor: (l) => l.saldo, render: (l) => fmtMonto(l.saldo), numerica: true },
      { titulo: 'Observaciones', valor: (l) => l.observaciones || null, numerica: true },
      {
        titulo: 'Etapas',
        valor: () => null,
        render: (l) => (
          <button
            type="button"
            onClick={() => {
              setAbierta(l.codigo_indec)
              requestAnimationFrame(() => detalleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
            }}
            className="text-xs font-medium text-gov-blue hover:underline"
          >
            Ver detalle
          </button>
        ),
      },
    ],
    [],
  )

  if (q.isError) return <Aviso tono="error">No pudimos cargar el Fondo Federal. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.localidades.length) return <Aviso tono="warn">Todavía no hay datos sincronizados de la planilla del Fondo Federal.</Aviso>

  const delAnio = anio === 'gestion' ? undefined : d.por_anio.find((a) => a.anio === anio)
  const porAnio = [...d.por_anio].reverse()
  const otorgadoPeriodo = delAnio ? delAnio.otorgado : d.por_anio.reduce((a, x) => a + x.otorgado, 0)
  const pct = (n: number) => (d.localidades_adheridas ? n / d.localidades_adheridas : null)
  const filas = d.localidades.filter((l) => aplica(l, filtro))
  const detalle = d.localidades.find((l) => l.codigo_indec === abierta)
  const r = d.resumen
  const totalEtapas = d.estados.reduce((a, e) => a + e.etapas, 0)
  const colEtapas = columnasEtapas(d.ver_observaciones)

  const chip = (activo: boolean) =>
    `text-left rounded-lg border px-3 py-2 transition-colors ${activo ? 'border-gov-blue ring-2 ring-gov-blue/30 bg-[#eef5fa]' : 'border-slate-200 bg-white hover:border-gov-blue'}`

  return (
    <div className="space-y-4">
      {r ? (
        <Kpis>
          <Kpi label="Saldo en cuenta" valor={fmtMonto(r.saldo_cuenta)} detalle="según el resumen de la planilla" />
          <Kpi label="Etapas sin entregar (disponible)" valor={fmtMonto(r.disponible)} />
          <Kpi label="Etapas en proceso" valor={fmtMonto(r.en_proceso)} detalle="listas para pagar y pedidos observados" />
          <Kpi label="Déficit / superávit" valor={<span className={(r.deficit_superavit ?? 0) < 0 ? 'text-red-700' : ''}>{fmtMonto(r.deficit_superavit)}</span>} detalle="saldo menos disponible y en proceso" />
          <Kpi
            label="Amortizaciones restantes"
            valor={fmtMonto(r.amortizaciones_restantes)}
            detalle={r.tiempo_medio_amortizacion != null ? `tiempo medio ${r.tiempo_medio_amortizacion.toLocaleString('es-AR', { maximumFractionDigits: 1 })} meses` : undefined}
          />
        </Kpis>
      ) : (
        <Aviso>Saldo en cuenta, disponible y amortizaciones son del fondo entero: se ven sin filtro de localidad.</Aviso>
      )}

      <Kpis>
        <Kpi label="Última etapa habilitada" valor={d.ultima_etapa_habilitada ?? '—'} detalle={`${fmtN(d.localidades_adheridas)} localidades adheridas`} />
        <Kpi label="Otorgado en la gestión" valor={fmtMonto(d.otorgado)} detalle={`saldo a devolver ${fmtMonto(d.saldo)}`} />
        <button type="button" onClick={() => setFiltro(filtro?.tipo === 'rendicion' ? null : { tipo: 'rendicion' })} className={chip(filtro?.tipo === 'rendicion')} aria-pressed={filtro?.tipo === 'rendicion'}>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Deben rendición</p>
          <p className="text-[22px] font-bold text-amber-700 leading-tight tabular-nums">{fmtN(d.deben_rendicion)}</p>
          <p className="text-xs text-gray-500 mt-0.5">localidades · clic para filtrar</p>
        </button>
        <button type="button" onClick={() => setFiltro(filtro?.tipo === 'pendientes' ? null : { tipo: 'pendientes' })} className={chip(filtro?.tipo === 'pendientes')} aria-pressed={filtro?.tipo === 'pendientes'}>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Con etapas pendientes</p>
          <p className="text-[22px] font-bold text-gov-navy leading-tight tabular-nums">{fmtN(d.con_pendientes)}</p>
          <p className="text-xs text-gray-500 mt-0.5">localidades · clic para filtrar</p>
        </button>
      </Kpis>

      <Panel titulo="Etapas por estado" ayuda="Cada etapa de cada localidad. Hacé clic en un estado para ver en la tabla las localidades que tienen alguna etapa así.">
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {d.estados.map((e) => {
            const activo = filtro?.tipo === 'estado' && filtro.estado === e.estado
            return (
              <button key={e.estado} type="button" aria-pressed={activo} onClick={() => setFiltro(activo ? null : { tipo: 'estado', estado: e.estado })} className={chip(activo)}>
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-600">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: PENDIENTES.has(e.estado) && !e.estado.startsWith('LISTO') ? '#8aa4bb' : colorEstadoFondo(e.estado) }} />
                  {capital(e.estado)}
                </span>
                <span className="block text-lg font-bold text-gov-navy tabular-nums">{fmtN(e.etapas)}</span>
                <span className="block text-xs text-gray-500">
                  {fmtN(e.localidades)} localidades · {fmtMonto(e.estado.startsWith('PAGADO') ? e.otorgado : e.monto_etapa)} · {fmtPct(totalEtapas ? e.etapas / totalEtapas : null)}
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel titulo="Localidades que cobraron las últimas etapas" ayuda="Sobre las localidades adheridas, hoy.">
          <div className="grid grid-cols-2 gap-2">
            <Velocimetro valor={pct(d.recibieron_ultima)} etiqueta={`Etapa ${d.ultima_etapa_habilitada ?? '—'} (${fmtN(d.recibieron_ultima)})`} max={1} color="#2e8b57" />
            <Velocimetro valor={pct(d.recibieron_anteultima)} etiqueta={`Etapa ${d.ultima_etapa_habilitada ? d.ultima_etapa_habilitada - 1 : '—'} (${fmtN(d.recibieron_anteultima)})`} max={1} />
          </div>
        </Panel>
        <Panel titulo="Otorgado por fecha de entrega" ayuda="Filtro propio de esta parte: por defecto, toda la gestión." extra={<SelectorAnio anios={d.anios} valor={anio} onChange={setAnio} etiqueta="Año de entrega" />}>
          <Kpis>
            <Kpi label="Otorgado" valor={fmtMonto(otorgadoPeriodo)} detalle={anio === 'gestion' ? 'en la gestión' : `en ${anio}`} />
            {delAnio && <Kpi label="Etapas entregadas" valor={fmtN(delAnio.etapas)} detalle={`${fmtN(delAnio.localidades)} localidades`} />}
          </Kpis>
          <div className="mt-3">
            {delAnio ? (
              <BarChart labels={MESES} values={delAnio.mensual.map((v) => (v ?? 0) / 1e6)} height={200} tooltipSuffix=" M" />
            ) : (
              <BarChart labels={porAnio.map((a) => String(a.anio))} values={porAnio.map((a) => a.otorgado / 1e6)} height={200} tooltipSuffix=" M" />
            )}
          </div>
        </Panel>
      </div>

      {d.copa.length > 0 && (
        <Panel
          titulo="Aportes y devoluciones por coparticipación"
          ayuda={`Lo que cada localidad aporta al fondo y lo que devuelve de sus préstamos, descontado de la COPA${d.copa_actualizada_hasta ? ` (actualizado hasta la COPA de ${fmtPeriodo(`${d.copa_actualizada_hasta}-01`)})` : ''}.`}
        >
          <div className="overflow-x-auto">
            <table className="text-[12.5px] min-w-[360px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="text-left px-2.5 py-1.5">Año</th>
                  <th className="text-right px-2.5 py-1.5">Aporte</th>
                  <th className="text-right px-2.5 py-1.5">Devolución de préstamos</th>
                </tr>
              </thead>
              <tbody>
                {d.copa.map((c) => (
                  <tr key={c.anio} className="border-t border-slate-100">
                    <td className="px-2.5 py-1.5 font-semibold">{c.anio}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtMonto(c.aporte)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtMonto(c.devolucion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div ref={detalleRef} className="scroll-mt-4">
        {detalle && (
          <Panel
            titulo={`${detalle.localidad} — etapas`}
            ayuda={`${detalle.departamento}${detalle.categoria ? ` · categoría ${detalle.categoria}` : ''}. Otorgado ${fmtMonto(detalle.otorgado)}, devuelto ${fmtMonto(detalle.devuelto)}, saldo a devolver ${fmtMonto(detalle.saldo)}.`}
            extra={
              <button type="button" onClick={() => setAbierta(null)} className="text-xs border border-slate-300 rounded-md px-3 py-1.5 hover:border-gov-blue">
                Cerrar
              </button>
            }
          >
            <Tabla columnas={colEtapas} filas={detalle.etapas} archivo={`fondo_federal_${detalle.codigo_indec}.xlsx`} />
          </Panel>
        )}
      </div>

      <Panel
        titulo="Etapas por localidad"
        ayuda={
          filtro ? (
            <>
              Mostrando{' '}
              {filtro.tipo === 'estado' ? `las localidades con alguna etapa "${capital(filtro.estado)}"` : filtro.tipo === 'rendicion' ? 'las que deben rendición' : 'las que tienen etapas pendientes'}.{' '}
              <button type="button" onClick={() => setFiltro(null)} className="text-gov-blue hover:underline">Ver todas</button>
            </>
          ) : (
            'En qué etapa está cada localidad, qué cobró, qué tiene pendiente y si debe rendiciones. "Ver detalle" abre cada etapa con su préstamo y su devolución.'
          )
        }
      >
        <Tabla
          columnas={colLocalidades}
          filas={filas}
          archivo="fondo_federal_localidades.xlsx"
          total={['Total', '', '', '', '', '', '', fmtN(filas.filter((l) => l.debe_rendicion).length), fmtMonto(filas.reduce((a, l) => a + l.otorgado, 0)), fmtMonto(filas.reduce((a, l) => a + l.saldo, 0)), '', '']}
        />
      </Panel>

      {!d.ver_observaciones && <Aviso>El texto de las observaciones solo lo ven los usuarios Admin y Autoridad.</Aviso>}
      <Aviso>
        Los préstamos del Fondo Federal no se suman al total del Resumen general: se devuelven, y estamos esperando que el área confirme cómo
        contarlos. El Fondo Permanente (etapas 1 a 55, planilla "7. FONDO PERMANENTE") sigue en su propia pantalla.
      </Aviso>
      <Fuente>planilla "0. Fondo Federal" de Gobierno, pestañas 1. Etapas habilitadas, 0. Resumen y 6. Copa (sincronizada a diario).</Fuente>
    </div>
  )
}
