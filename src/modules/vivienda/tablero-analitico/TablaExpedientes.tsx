import { Fragment, useState } from 'react'
import { AvanceCelda, fmtFechaObra } from '../avanceObra'
import { COLOR_PROGRAMA, documentacionDe, textoChecklist, urlChecklist, type GrupoLocalidad } from './expedientes'

const DOC_CLS = {
  completa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  incompleta: 'bg-rose-50 text-rose-700 border-rose-200',
  no_iniciada: 'bg-slate-50 text-slate-500 border-slate-200',
} as const

function Chip({ texto, bg, color, prefijo }: { texto: string | null; bg?: string | null; color?: string | null; prefijo?: string }) {
  if (!texto) return null
  return (
    <span
      className="inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium border border-black/5"
      style={{ backgroundColor: bg ?? '#f1f5f9', color: color ?? '#334155' }}
      title={prefijo ? `${prefijo}: ${texto}` : texto}
    >
      {prefijo && <b className="mr-1 opacity-60">{prefijo}</b>}
      {texto}
    </span>
  )
}

export function TablaExpedientes({
  grupos,
  conDistancia,
  enRecorrido,
  onToggleRecorrido,
}: {
  grupos: GrupoLocalidad[]
  conDistancia: boolean
  enRecorrido: Set<string>
  onToggleRecorrido: (g: GrupoLocalidad) => void
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (!grupos.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-gray-400">
        Ningún expediente coincide con los filtros.
      </div>
    )
  }

  const th = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th scope="col" className={th}>Localidad</th>
            {conDistancia && <th scope="col" className={th}>Distancia</th>}
            <th scope="col" className={th}>Programa</th>
            <th scope="col" className={th}>Estado</th>
            <th scope="col" className={th}>Checklist</th>
            <th scope="col" className={th}>Avance obra</th>
            <th scope="col" className={th}>Últ. comunicación</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) =>
            g.expedientes.map((e, i) => {
              const abierto = abiertos.has(e.entidad_id)
              const doc = documentacionDe(e)
              return (
                <Fragment key={e.entidad_id}>
                  <tr className={`align-top ${i === g.expedientes.length - 1 && !abierto ? 'border-b border-slate-100' : ''} hover:bg-slate-50/60`}>
                    {i === 0 && (
                      <td rowSpan={g.expedientes.length + g.expedientes.filter((x) => abiertos.has(x.entidad_id)).length}
                        className="px-3 py-2 border-b border-slate-100 min-w-[150px]">
                        <p className="font-semibold text-gov-navy">{g.localidad}</p>
                        <p className="text-[11px] text-gray-400 uppercase">{g.departamento ?? '—'}</p>
                        <p className="text-[10px] text-gray-400">
                          {g.expedientes.length} expediente{g.expedientes.length === 1 ? '' : 's'}
                        </p>
                        {g.lat !== null ? (
                          <button type="button" onClick={() => onToggleRecorrido(g)}
                            className={`mt-1 text-[10px] rounded px-1.5 py-0.5 border ${enRecorrido.has(g.clave)
                              ? 'bg-gov-cyan/10 border-gov-cyan text-gov-navy'
                              : 'border-slate-200 text-gray-500 hover:border-gov-cyan'}`}>
                            {enRecorrido.has(g.clave) ? '✓ En recorrido' : '+ Recorrido'}
                          </button>
                        ) : (
                          <p className="text-[10px] text-amber-600 mt-1">Sin coordenadas</p>
                        )}
                      </td>
                    )}
                    {conDistancia && i === 0 && (
                      <td rowSpan={g.expedientes.length + g.expedientes.filter((x) => abiertos.has(x.entidad_id)).length}
                        className="px-3 py-2 border-b border-slate-100 whitespace-nowrap font-semibold text-gov-blue">
                        {g.distanciaKm === null ? '—' : `${g.distanciaKm.toFixed(1)} km`}
                      </td>
                    )}
                    <td className="px-3 py-2 min-w-[150px]">
                      <button type="button" onClick={() => toggle(e.entidad_id)} aria-expanded={abierto}
                        className="text-left">
                        <span className="flex items-center gap-1.5 font-medium text-gov-navy">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_PROGRAMA[e.programa] }} />
                          {e.programa_label}
                          <span className="text-gray-400 text-[10px]">{abierto ? '▲' : '▼'}</span>
                        </span>
                        {e.detalle && <span className="block text-[11px] text-gray-500">{e.detalle}</span>}
                        {e.expediente && <span className="block text-[10px] text-gray-400">{e.expediente}</span>}
                      </button>
                    </td>
                    <td className="px-3 py-2 min-w-[200px] max-w-[300px]">
                      <div className="flex flex-col gap-0.5 items-start">
                        <Chip texto={e.estado_general_label} bg={e.estado_general_bg} color={e.estado_general_text_color} />
                        <Chip texto={e.subestados?.juridico ?? null} bg="#fef3c7" color="#92400e" prefijo="J" />
                        <Chip texto={e.subestados?.tecnico ?? null} bg="#e0f2fe" color="#075985" prefijo="T" />
                        <Chip texto={e.subestados?.financiero ?? null} bg="#dcfce7" color="#166534" prefijo="F" />
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a
                        href={urlChecklist(e)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir el Checklist Técnico de este expediente (pestaña nueva)"
                        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] hover:underline hover:shadow-sm ${DOC_CLS[doc]}`}
                      >
                        {textoChecklist(e)} ↗
                      </a>
                    </td>
                    <td className="px-3 py-2"><AvanceCelda o={e} /></td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {e.ultima_comunicacion ? fmtFechaObra(e.ultima_comunicacion.fecha) : '—'}
                    </td>
                  </tr>
                  {abierto && (
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      {/* La localidad (y la distancia) ya ocupan su columna con rowSpan: quedan las 5 del expediente */}
                      <td colSpan={5} className="px-3 py-2 text-xs">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">
                              Documentación faltante ({e.checklist_faltantes.length})
                            </p>
                            {e.checklist_faltantes.length ? (
                              <ul className="list-disc pl-4 text-gray-600 space-y-0.5 max-h-40 overflow-y-auto">
                                {e.checklist_faltantes.map((f) => <li key={f}>{f}</li>)}
                              </ul>
                            ) : (
                              <p className="text-gray-400">{e.checklist_iniciado ? 'Nada pendiente' : 'Checklist no iniciado'}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Última comunicación</p>
                            {e.ultima_comunicacion ? (
                              <p className="text-gray-600">
                                <b>{fmtFechaObra(e.ultima_comunicacion.fecha)}</b>
                                {e.ultima_comunicacion.autor && ` · ${e.ultima_comunicacion.autor}`}
                                <br />
                                {e.ultima_comunicacion.texto ?? <i className="text-gray-400">Texto reservado al área</i>}
                              </p>
                            ) : (
                              <p className="text-gray-400">Sin comunicaciones</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            }),
          )}
        </tbody>
      </table>
    </div>
  )
}
