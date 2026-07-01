import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { beneficiariosApi } from '../api/vivienda.api'

export function BeneficiariosListPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['beneficiarios', search],
    queryFn: () => beneficiariosApi.list({ q: search || undefined, limit: 50 }),
    placeholderData: keepPreviousData,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Beneficiarios</h2>
        <Link
          to="/vivienda/beneficiarios/nuevo"
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
        >
          + Nuevo beneficiario
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['DNI', 'Apellido y nombre', 'Localidad', 'Teléfono', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron beneficiarios
                  </td>
                </tr>
              )}
              {data?.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{b.dni}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {b.apellido}, {b.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.domicilio_localidad || '—'}
                    {b.domicilio_departamento ? ` (${b.domicilio_departamento})` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{b.telefono || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/vivienda/beneficiarios/${b.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
