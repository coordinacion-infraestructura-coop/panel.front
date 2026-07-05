import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { expedientesApi } from '../api/vivienda.api'
import type { EstadoExpediente } from '../types/vivienda.types'

const ESTADO_COLORS: Record<EstadoExpediente, string> = {
  INGRESADO: 'bg-blue-100 text-blue-700',
  EN_EVALUACION: 'bg-yellow-100 text-yellow-700',
  DOCS_PENDIENTE: 'bg-orange-100 text-orange-700',
  APROBADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-red-100 text-red-700',
  EN_LISTA_ESPERA: 'bg-purple-100 text-purple-700',
  ASIGNADO: 'bg-teal-100 text-teal-700',
  BAJA: 'bg-gray-100 text-gray-500',
}

const ESTADOS: EstadoExpediente[] = [
  'INGRESADO', 'EN_EVALUACION', 'DOCS_PENDIENTE', 'APROBADO',
  'RECHAZADO', 'EN_LISTA_ESPERA', 'ASIGNADO', 'BAJA',
]

export function ExpedientesListPage() {
  const [estado, setEstado] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['expedientes', estado],
    queryFn: () => expedientesApi.list({ estado: estado || undefined, limit: 50 }),
    placeholderData: keepPreviousData,
  })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gov-navy">Expedientes</h2>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={() => setEstado('')}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${!estado ? 'bg-gov-navy text-white border-gov-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        >
          Todos
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${estado === e ? 'bg-gov-navy text-white border-gov-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            {e.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-gov-navy text-white">
              <tr>
                {['Número', 'Beneficiario', 'Programa', 'Estado', 'Fecha ingreso'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No hay expedientes{estado ? ` en estado ${estado}` : ''}
                  </td>
                </tr>
              )}
              {data?.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-700">{exp.numero}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {exp.beneficiario
                      ? `${exp.beneficiario.apellido}, ${exp.beneficiario.nombre}`
                      : exp.beneficiario_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {exp.programa?.nombre ?? exp.programa_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLORS[exp.estado]}`}>
                      {exp.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(exp.fecha_ingreso).toLocaleDateString('es-AR')}
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
