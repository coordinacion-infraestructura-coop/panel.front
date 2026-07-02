const LOOKER_URL =
  'https://lookerstudio.google.com/embed/reporting/f9dc4a4e-a174-45a8-938c-385f4121f689/page/fP1fF'

export function TableroPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Tablero de gestiones</h2>
          <p className="text-sm text-gray-500 mt-0.5">Análisis y estadísticas del sistema</p>
        </div>
        <a
          href={LOOKER_URL.replace('/embed/', '/')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
        >
          Abrir en Looker Studio ↗
        </a>
      </div>
      <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" style={{ minHeight: '600px' }}>
        <iframe
          src={LOOKER_URL}
          title="Tablero de gestiones — Looker Studio"
          className="w-full h-full border-0"
          style={{ minHeight: '600px' }}
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  )
}
