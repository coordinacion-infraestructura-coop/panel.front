import type { FuenteFrescura } from '../api/tablero.api'

const ESTADO: Record<FuenteFrescura['estado'], { texto: string; color: string; peso: number }> = {
  fallido: { texto: 'Falló la última actualización', color: 'bg-red-500', peso: 3 },
  parcial: { texto: 'Actualización parcial', color: 'bg-amber-500', peso: 2 },
  sin_datos: { texto: 'Sin datos todavía', color: 'bg-slate-400', peso: 1 },
  ok: { texto: 'Al día', color: 'bg-emerald-500', peso: 0 },
}

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

const periodo = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : null

/** Una pastilla con el peor estado entre las fuentes; al abrirla, el detalle de cada una.
 * Hace visible cuando una planilla deja de sincronizar (como ATP del 9 al 19/10/2026). */
export function IndicadorFrescura({ fuentes }: { fuentes: FuenteFrescura[] }) {
  const peor = fuentes.reduce<FuenteFrescura | null>(
    (a, f) => (!a || ESTADO[f.estado].peso > ESTADO[a.estado].peso ? f : a),
    null,
  )
  if (!peor) return null
  const resumen = peor.estado === 'ok' ? 'Fuentes al día' : `${ESTADO[peor.estado].texto}: ${peor.etiqueta}`

  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer inline-flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:border-gov-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan max-w-[320px]">
        <span className={`w-2 h-2 rounded-full flex-none ${ESTADO[peor.estado].color}`} aria-hidden="true" />
        <span className="truncate">{resumen}</span>
        <span className="text-gray-400 group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(360px,calc(100vw-32px))] bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Frescura de las fuentes</p>
        <ul className="space-y-2">
          {fuentes.map((f) => (
            <li key={f.fuente} className="flex gap-2 text-xs">
              <span className={`mt-1 w-2 h-2 rounded-full flex-none ${ESTADO[f.estado].color}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium text-gov-navy">{f.etiqueta}</span>
                <span className="block text-gray-500">
                  {ESTADO[f.estado].texto}
                  {f.ultima_corrida && ` · última corrida ${fecha(f.ultima_corrida)}`}
                  {f.ultimo_periodo && ` · último período ${periodo(f.ultimo_periodo)}`}
                  {f.detalle && ` · ${f.detalle}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
