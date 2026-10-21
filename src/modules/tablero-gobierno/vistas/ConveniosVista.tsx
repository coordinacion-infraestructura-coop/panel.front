import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { tableroApi, type ConvenioLocalidad, type ConvenioValor } from '../api/tablero.api'
import { Aviso, Cargando, Fuente, Kpi, Kpis, Panel, Tabla, type Columna } from '../components/Bloques'
import { fmtN, fmtPct } from '../formato'
import type { ContextoTablero } from './contexto'

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function Celda({ v }: { v: ConvenioValor | undefined }) {
  if (!v || (v.valor == null && v.cantidad == null)) return <span className="text-gray-400">—</span>
  if (v.cantidad != null) return <span className="tabular-nums">{v.cantidad}</span>
  const cls = v.valor === 'SI' ? 'text-emerald-700 font-semibold' : v.valor === 'NO' ? 'text-red-700' : 'text-gray-500'
  return <span className={cls} title={v.detalle ?? undefined}>{v.valor}{v.detalle ? ` (${v.detalle})` : ''}</span>
}

const firmo = (v: ConvenioValor | undefined) => !!v && (v.valor === 'SI' || (v.cantidad ?? 0) > 0)

/** Convenios (Etapa 5): planilla "6. CONVENIOS FIRMADOS Y RADIOS", pestaña Convenios. Matriz
 * SI / NO por localidad y el listado de las que todavía no firmaron un convenio elegido. */
export function ConveniosVista({ ctx }: { ctx: ContextoTablero }) {
  const [elegido, setElegido] = useState('')
  const q = useQuery({ queryKey: ['tablero-gobierno', 'convenios', ctx.codigos], queryFn: () => tableroApi.convenios(ctx.codigos) })
  if (q.isError) return <Aviso tono="error">No pudimos cargar los convenios. Probá de nuevo en un rato.</Aviso>
  if (!q.data) return <Cargando />
  const d = q.data
  if (!d.localidades.length) return <Aviso tono="warn">{ctx.codigos ? 'No hay convenios para este filtro.' : 'Todavía no hay datos sincronizados de la planilla de convenios.'}</Aviso>
  const conv = elegido || d.convenios[0]
  const total = d.localidades.length
  const columnas: Columna<ConvenioLocalidad>[] = [
    { titulo: 'Departamento', valor: (f) => f.departamento },
    { titulo: 'Localidad', valor: (f) => f.localidad },
    ...d.convenios.map((c) => ({
      titulo: capital(c),
      valor: (f: ConvenioLocalidad) => f.valores[c]?.cantidad ?? f.valores[c]?.valor ?? null,
      render: (f: ConvenioLocalidad) => <Celda v={f.valores[c]} />,
    })),
  ]
  const sinFirmar = d.localidades.filter((l) => !firmo(l.valores[conv]))
  const destacados = d.resumen.filter((r) => r.cantidad == null).slice(0, 4)

  return (
    <div className="space-y-4">
      <Kpis>
        <Kpi label="Localidades" valor={fmtN(total)} />
        {destacados.map((r) => (
          <Kpi key={r.convenio} label={capital(r.convenio)} valor={fmtPct(total ? r.si / total : null)} detalle={`${fmtN(r.si)} de ${fmtN(total)} firmaron`} />
        ))}
      </Kpis>

      <Panel titulo="Por convenio" ayuda="Localidades que firmaron cada convenio. Polideportivos y parques industriales son cantidades.">
        <table className="w-full text-sm">
          <tbody>
            {d.resumen.map((r) => {
              const v = total ? r.si / total : 0
              return (
                <tr key={r.convenio} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-gov-navy">{capital(r.convenio)}</td>
                  <td className="py-1.5 w-1/3">
                    <span className="block h-2 bg-slate-100 rounded-full overflow-hidden" aria-hidden>
                      <span className="block h-full bg-gov-blue" style={{ width: `${Math.round(v * 100)}%` }} />
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtN(r.si)} de {fmtN(total)}</td>
                  <td className="py-1.5 text-right tabular-nums w-20">{fmtPct(v)}</td>
                  <td className="py-1.5 text-right text-xs text-gray-500 w-36">
                    {r.cantidad != null ? `${fmtN(r.cantidad)} en total` : r.nc ? `${fmtN(r.nc)} no corresponde` : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      <Panel
        titulo="Localidades por firmar"
        ayuda="Localidades que todavía no firmaron el convenio elegido."
        extra={
          <select value={conv} onChange={(e) => setElegido(e.target.value)} aria-label="Convenio" className="text-sm border border-slate-300 rounded-md px-2 py-1">
            {d.convenios.map((c) => (
              <option key={c} value={c}>{capital(c)}</option>
            ))}
          </select>
        }
      >
        <Tabla columnas={columnas.slice(0, 2)} filas={sinFirmar} archivo={`por_firmar_${conv.toLowerCase().replace(/\s+/g, '_')}.xlsx`} />
      </Panel>

      <Panel titulo="Matriz de convenios" ayuda="SI / NO por localidad (NC: no corresponde). En la radio, entre paréntesis, el año.">
        <Tabla columnas={columnas} filas={d.localidades} archivo="matriz_convenios.xlsx" />
      </Panel>
      <Fuente>planilla "6. CONVENIOS FIRMADOS Y RADIOS" de Gobierno, pestaña Convenios (sincronizada a diario).</Fuente>
    </div>
  )
}
