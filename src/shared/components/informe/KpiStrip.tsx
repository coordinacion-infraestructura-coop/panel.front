export interface Kpi {
  value: string | number
  label: string
  accent?: 'navy' | 'cyan' | 'green' | 'red' | 'orange'
}

const ACCENT_COLOR: Record<NonNullable<Kpi['accent']>, string> = {
  navy: '#172c3f',
  cyan: '#01aae3',
  green: '#15803d',
  red: '#b91c1c',
  orange: '#c2410c',
}

/** Tira de KPIs — mismo look que las tarjetas `.kpi` del informe de referencia
 * (proyecto_sistema_gestiones/informe), adaptada a Tailwind. */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((k, i) => (
        <div
          key={i}
          className="bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm min-w-[110px]"
        >
          <b
            className="block text-2xl font-extrabold leading-none mb-1"
            style={{ color: ACCENT_COLOR[k.accent ?? 'navy'] }}
          >
            {k.value}
          </b>
          <small className="text-[10px] text-gray-400 uppercase tracking-wide">{k.label}</small>
        </div>
      ))}
    </div>
  )
}
