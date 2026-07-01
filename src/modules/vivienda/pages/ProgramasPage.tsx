import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { programasApi } from '../api/vivienda.api'

const CORDON_CUNETA_CODIGO = 'CORDON-CUNETA'

export function ProgramasPage() {
  const { data: programas, isLoading, error } = useQuery({
    queryKey: ['programas'],
    queryFn: programasApi.list,
  })

  if (isLoading) return <div className="text-center py-12 text-gray-500">Cargando programas...</div>
  if (error) return <div className="text-red-600 py-4">Error al cargar programas.</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Programas Habitacionales</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {programas?.map((p) => {
          const isCordonCuneta = p.codigo === CORDON_CUNETA_CODIGO

          const card = (
            <div
              className={`bg-white rounded-lg border p-5 shadow-sm transition-shadow ${
                isCordonCuneta
                  ? 'border-green-300 hover:shadow-md cursor-pointer'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {p.codigo}
                    </span>
                    {isCordonCuneta && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">
                        Ver panel →
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-gray-900">{p.nombre}</h3>
                  {p.descripcion && (
                    <p className="mt-1 text-sm text-gray-500">{p.descripcion}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ml-3 flex-shrink-0 ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {p.requiere_ingreso_max && p.ingreso_max && (
                <p className="mt-3 text-xs text-gray-400">
                  Ingreso máx: ${p.ingreso_max.toLocaleString('es-AR')}
                </p>
              )}
            </div>
          )

          return isCordonCuneta ? (
            <Link key={p.id} to="/vivienda/cordon-cuneta" className="block no-underline">
              {card}
            </Link>
          ) : (
            <div key={p.id}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}
