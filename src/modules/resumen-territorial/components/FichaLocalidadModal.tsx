// Ficha de Localidad — modal de pantalla completa que reemplaza el viejo
// DetailDrawer lateral. Reusa armarFichaMunicipio (ya arma PDF/Excel con
// datos item por item de Privada/Gasífera/ATP) para no duplicar el camino de
// datos — sólo le suma la sección de transferencias, que ya viaja en el
// payload de resumen_territorial (ResumenLocalidad), no en armarFichaMunicipio.
//
// z-index muy por encima de Leaflet (que usa hasta ~1000 en sus paneles
// internos) a propósito — el DetailDrawer anterior usaba z-40/z-50 y el mapa
// le ganaba la pulseada de capas, dejándolo no funcional (feedback QA visual).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { armarFichaMunicipio, fichaMunicipioPdf, fichaMunicipioXlsx } from '../fichaMunicipio'
import type { ResumenLocalidad } from '../types/resumenTerritorial.types'

const SEMAFORO_DOT: Record<string, string> = { Verde: 'bg-green-500', Amarillo: 'bg-yellow-400', Rojo: 'bg-red-500' }
const fmtMoney = (n: number | null | undefined) => (n == null ? '—' : `$ ${Math.round(n).toLocaleString('es-AR')}`)

const CONCEPTO_LABEL: Record<string, string> = {
  coparticipacion_ley_8663: 'Coparticipación Ley Provincial N° 8663',
  fasamu: 'FASAMU',
  fofindes: 'FOFINDES',
  fondo_compensacion: 'Fondo Compensación',
  bono_consenso_fiscal: 'Bono Consenso Fiscal',
}
const CONCEPTO_ORDEN = ['coparticipacion_ley_8663', 'fasamu', 'fofindes', 'fondo_compensacion', 'bono_consenso_fiscal']

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-extrabold text-gov-navy">{icon} {title}</span>
      {badge && (
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-dceffb bg-[#dceffb] text-[#036aa1]">
          {badge}
        </span>
      )}
    </div>
  )
}

function EstadoChip({ label, bg }: { label: string; bg?: string | null }) {
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: bg ?? '#e5e7eb', color: bg ? undefined : '#374151' }}
    >
      {label}
    </span>
  )
}

export function FichaLocalidadModal({
  resumen,
  onClose,
}: {
  resumen: ResumenLocalidad | null
  onClose: () => void
}) {
  const habilitado = !!resumen?.departamento && !!resumen?.localidad

  const { data: ficha, isLoading, isError } = useQuery({
    queryKey: ['ficha-municipio', resumen?.departamento, resumen?.localidad],
    queryFn: () => armarFichaMunicipio(resumen!.departamento!, resumen!.localidad),
    enabled: habilitado,
    staleTime: 2 * 60 * 1000,
  })

  useEffect(() => {
    if (!resumen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resumen, onClose])

  const [fichaBusy, setFichaBusy] = useState<null | 'pdf' | 'xlsx'>(null)
  const [fichaError, setFichaError] = useState<string | null>(null)

  async function descargar(fmt: 'pdf' | 'xlsx') {
    if (!ficha || fichaBusy) return
    setFichaBusy(fmt)
    setFichaError(null)
    try {
      if (fmt === 'pdf') await fichaMunicipioPdf(ficha)
      else fichaMunicipioXlsx(ficha)
    } catch {
      setFichaError('No se pudo generar la descarga. Reintentá.')
    } finally {
      setFichaBusy(null)
    }
  }

  if (!resumen) return null

  const semLabel = ficha?.demografica.color_semaforo
  const transferenciasPorConcepto = resumen.transferencias_por_concepto ?? {}
  const conceptosTraidos = CONCEPTO_ORDEN.filter((c) => transferenciasPorConcepto[c] != null)
  const hayTransferencias = conceptosTraidos.length > 0 || resumen.transferencias_total != null

  return (
    // z-[2000]: muy por encima de los paneles internos de Leaflet (hasta ~1000).
    <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gov-navy text-white px-6 py-5 relative">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 w-8 h-8 rounded text-sm"
          >
            ✕
          </button>
          <p className="text-[10px] uppercase tracking-widest text-gov-cyan font-bold">Ficha de localidad</p>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap pr-10">
            <h2 className="text-2xl font-extrabold">{resumen.localidad}</h2>
            <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full">Depto. {resumen.departamento ?? '—'}</span>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {semLabel && semLabel !== '—' && (
              <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[semLabel] ?? 'bg-gray-400'}`} /> Semáforo {semLabel}
              </span>
            )}
            {resumen.categoria && (
              <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full">
                {resumen.categoria === 'MU' ? 'Municipio' : 'Comuna'}
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => descargar('pdf')}
              disabled={!ficha || fichaBusy !== null}
              className="text-xs bg-white text-gov-navy font-semibold rounded px-3 py-1.5 disabled:opacity-50"
            >
              {fichaBusy === 'pdf' ? 'Generando…' : '📄 PDF'}
            </button>
            <button
              onClick={() => descargar('xlsx')}
              disabled={!ficha || fichaBusy !== null}
              className="text-xs bg-white/15 text-white font-semibold rounded px-3 py-1.5 disabled:opacity-50"
            >
              {fichaBusy === 'xlsx' ? '…' : 'Excel'}
            </button>
          </div>
        </div>

        {fichaError && <p className="text-xs text-red-600 px-6 pt-3">{fichaError}</p>}

        {isLoading && (
          <div className="py-16 text-center text-sm text-gray-400">Cargando ficha de la localidad…</div>
        )}
        {isError && (
          <div className="py-16 text-center text-sm text-red-500">
            No se pudo cargar la ficha completa. Reintentá cerrando y volviendo a abrir.
          </div>
        )}

        {ficha && (
          <div className="divide-y divide-slate-100">
            {/* KPIs rápidos */}
            <div className="px-6 py-4 flex gap-3 flex-wrap">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                <div className="text-lg font-extrabold text-gov-navy leading-none">{ficha.demografica.habitantes}</div>
                <div className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">Habitantes</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                <div className="text-lg font-extrabold text-gov-navy leading-none">{ficha.demografica.electores}</div>
                <div className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">Electores</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                <div className="text-lg font-extrabold text-gov-cyan leading-none">{ficha.gestiones.total}</div>
                <div className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">Gestiones</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                <div className="text-lg font-extrabold text-gov-navy leading-none">
                  {(ficha.cordobaHogar ? 1 : 0) + (ficha.cordonCuneta ? 1 : 0) + ficha.miLugar.length}
                </div>
                <div className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">Programas DGV</div>
              </div>
              {resumen.atp_monto_per_capita != null && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                  <div className="text-lg font-extrabold text-[#c2410c] leading-none">{fmtMoney(resumen.atp_monto_per_capita)}</div>
                  <div className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">ATP per cápita</div>
                </div>
              )}
              {resumen.transferencias_total != null && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                  <div className="text-lg font-extrabold text-[#15803d] leading-none">{fmtMoney(resumen.transferencias_total)}</div>
                  <div className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">
                    Transferencias{resumen.transferencias_periodo ? ` · ${resumen.transferencias_periodo}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Demográfica y política */}
            <div className="px-6 py-5">
              <SectionHeader icon="👤" title="Ficha demográfica y política" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-[11px] text-gray-400 uppercase">Habitantes</dt><dd className="font-semibold text-gov-navy">{ficha.demografica.habitantes}</dd></div>
                <div><dt className="text-[11px] text-gray-400 uppercase">Electores</dt><dd className="font-semibold text-gov-navy">{ficha.demografica.electores}</dd></div>
                <div className="col-span-2"><dt className="text-[11px] text-gray-400 uppercase">Intendente / Jefe comunal</dt><dd className="text-slate-700">{ficha.demografica.intendente}{ficha.demografica.partido !== '—' ? ` · ${ficha.demografica.partido}` : ''}</dd></div>
                <div className="col-span-2"><dt className="text-[11px] text-gray-400 uppercase">Tipo de localidad</dt><dd className="text-slate-700">{ficha.demografica.tipo_localidad}</dd></div>
                <div className="col-span-2"><dt className="text-[11px] text-gray-400 uppercase">Legislador departamental</dt><dd className="text-slate-700">{ficha.demografica.legislador_departamental}{ficha.demografica.partido_legislador !== '—' ? ` · ${ficha.demografica.partido_legislador}` : ''}</dd></div>
              </dl>
            </div>

            {/* Vivienda DGV */}
            <div className="px-6 py-5">
              <SectionHeader icon="🏠" title="Vivienda — DGV" />
              <div className="flex flex-col gap-2.5">
                {ficha.cordonCuneta && (
                  <div className="border border-slate-200 rounded-lg p-3.5">
                    <div className="flex justify-between items-center">
                      <b className="text-sm text-gov-navy">Cordón Cuneta</b>
                      <EstadoChip label={ficha.cordonCuneta.estado_general} bg={ficha.cordonCuneta.estado_bg} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Monto {ficha.cordonCuneta.monto} · Avance {ficha.cordonCuneta.avance} · {ficha.cordonCuneta.volumen}
                    </p>
                  </div>
                )}
                {ficha.cordobaHogar && (
                  <div className="border border-slate-200 rounded-lg p-3.5">
                    <div className="flex justify-between items-center">
                      <b className="text-sm text-gov-navy">Córdoba Hogar</b>
                      <EstadoChip label={ficha.cordobaHogar.estado_general} bg={ficha.cordobaHogar.estado_bg} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Monto {ficha.cordobaHogar.monto} · Viviendas {ficha.cordobaHogar.casas} · Avance {ficha.cordobaHogar.avance}
                    </p>
                  </div>
                )}
                {ficha.miLugar.map((m, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3.5">
                    <div className="flex justify-between items-center">
                      <b className="text-sm text-gov-navy">Mi Lugar</b>
                      <EstadoChip label={m.estado_general} bg={m.estado_bg} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">Lotes {m.lotes} · Monto {m.monto} · Avance {m.avance}</p>
                  </div>
                ))}
                {!ficha.cordonCuneta && !ficha.cordobaHogar && ficha.miLugar.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Sin programas de Vivienda cargados para esta localidad.</p>
                )}
              </div>
            </div>

            {/* Gestiones Privada */}
            <div className="px-6 py-5">
              <SectionHeader icon="📋" title="Gestiones — Sec. Privada" badge={`Total ${ficha.gestiones.total}`} />
              {ficha.gestiones.filas.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin gestiones registradas para esta localidad.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {ficha.gestiones.filas.map((g) => (
                    <div key={g.id_gestion} className="border border-slate-200 rounded-lg p-3.5">
                      <b className="text-sm text-gov-navy">Campo de trabajo: {g.campo_trabajo || '—'}</b>
                      <p className="text-xs text-slate-600 mt-1">{g.detalle || '—'}</p>
                      <div className="flex justify-between items-center mt-2 flex-wrap gap-1.5">
                        <span className="text-[11px] text-gray-400">
                          Ingreso {g.fecha_ingreso || '—'} · Exp. {g.nro_expediente || 'sin expediente'}
                          {g.costo_estimado != null ? ` · $${g.costo_estimado.toLocaleString('es-AR')}` : ''}
                        </span>
                        <EstadoChip label={g.estado || 'Sin estado'} bg="#fdf0d5" />
                      </div>
                    </div>
                  ))}
                  <Link
                    to={`/privada/gestiones?departamento=${encodeURIComponent(resumen.departamento ?? '')}&localidad=${encodeURIComponent(resumen.localidad)}`}
                    className="text-xs text-gov-cyan hover:text-gov-navy self-start"
                  >
                    Ver todas en el panel de Privada →
                  </Link>
                </div>
              )}
            </div>

            {/* ATP */}
            <div className="px-6 py-5">
              <SectionHeader icon="🏛" title="ATP — Sec. Gral. de Gobierno" badge={`Total ${ficha.atp.total}`} />
              {ficha.atp.filas.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin compromisos ATP registrados para esta localidad.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {ficha.atp.filas.map((c) => {
                    const pagado = c.entregado != null && c.monto ? Math.min(1, c.entregado / c.monto) : 0
                    const estado = c.entregado == null || c.entregado <= 0 ? 'Pendiente' : c.monto != null && c.entregado >= c.monto ? 'Pagado' : 'Parcial'
                    const bg = estado === 'Pagado' ? '#dcf5e3' : estado === 'Parcial' ? '#fdf0d5' : '#fee2e2'
                    return (
                      <div key={c.id} className="border border-slate-200 rounded-lg p-3.5">
                        <div className="flex justify-between items-center">
                          <b className="text-sm text-gov-navy">Destino: {c.destino}</b>
                          <EstadoChip label={estado} bg={bg} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          Anuncio {c.fecha_anuncio} · Monto {fmtMoney(c.monto)} · Entregado {fmtMoney(c.entregado)}
                        </p>
                        {c.monto != null && (
                          <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gov-cyan" style={{ width: `${pagado * 100}%` }} />
                          </div>
                        )}
                        {c.entregas.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-2">
                            {c.entregas.map((e, j) => (
                              <span key={j} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                {e.periodo.slice(0, 7)}: {fmtMoney(e.monto)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* PIT Gas */}
            <div className="px-6 py-5">
              <SectionHeader icon="🔥" title="PIT Gas — Sec. Gasífera" badge={`Total ${ficha.gasifera.total}`} />
              {ficha.gasifera.filas.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin acciones de Gasífera registradas para esta localidad.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {ficha.gasifera.filas.map((a) => (
                    <div key={a.id} className="border border-slate-200 rounded-lg p-3.5">
                      <div className="flex justify-between items-center">
                        <b className="text-sm text-gov-navy">{a.accion}</b>
                        <EstadoChip label={a.estado} bg={a.estado.toLowerCase() === 'cumplido' ? '#dcf5e3' : '#fdf0d5'} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {a.etapa} · Monto {a.monto_solicitado != null ? fmtMoney(a.monto_solicitado) : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Datos externos: transferencias */}
            <div className="px-6 py-5">
              <SectionHeader
                icon="💰"
                title="Datos externos — Transferencias"
                badge={resumen.transferencias_periodo ? `Período ${resumen.transferencias_periodo}` : undefined}
              />
              {!hayTransferencias ? (
                <p className="text-xs text-gray-400 italic">Sin transferencias cargadas para esta localidad.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                  {conceptosTraidos.map((c) => (
                    <div key={c} className="flex justify-between px-4 py-2.5 border-b border-slate-100">
                      <span className="text-gray-500">{CONCEPTO_LABEL[c]}</span>
                      <b className="text-gov-navy">{fmtMoney(transferenciasPorConcepto[c])}</b>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2.5 bg-slate-50">
                    <span className="font-semibold text-gov-navy">Total</span>
                    <b className="text-[#15803d]">{fmtMoney(resumen.transferencias_total)}</b>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-slate-50">
                    <span className="font-semibold text-gov-navy">Total per cápita</span>
                    <b className="text-[#15803d]">{fmtMoney(resumen.transferencias_per_capita)}</b>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 text-center text-[10px] text-gray-400">
              Datos consolidados de 5 fuentes (Vivienda · Privada · Gasífera · ATP · Censo/Transferencias)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
