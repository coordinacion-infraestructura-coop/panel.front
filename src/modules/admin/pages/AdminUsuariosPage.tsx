import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../shared/api/client'
import type { AreaAcceso, NivelArea } from '../../../shared/utils/permisos'

interface PortalUsuario {
  email: string
  nombre?: string
  rol: string
  secretarias: string[]
  areas?: AreaAcceso[]
  activo: boolean
  created_at: string
}

interface UsuarioPayload {
  email?: string
  nombre?: string
  rol: string
  secretarias: string[]
  areas: AreaAcceso[]
  activo?: boolean
}

// Catálogo de áreas de acceso por secretaría (GET /api/v1/portal/areas).
type CatalogoAreas = Record<string, { area: string; label: string }[]>

function useCatalogoAreas() {
  return useQuery<CatalogoAreas>({
    queryKey: ['portal-areas'],
    queryFn: () => apiClient.get('/api/v1/portal/areas').then((r) => r.data),
    staleTime: Infinity,
  })
}

const ROLES = ['Admin', 'Supervisor', 'Operador', 'Consulta', 'Autoridad'] as const
const SECRETARIAS = [
  { id: 'vivienda', label: 'Vivienda' },
  { id: 'privada', label: 'Privada del Ministro' },
  { id: 'infraestructura', label: 'Gestión e Infraestructura' },
  { id: 'territorial', label: 'Planificación Territorial' },
  { id: 'gasifera', label: 'Infraestructura Gasífera' },
  { id: 'gralgob', label: 'General de Gobierno' },
  { id: 'desarrollo', label: 'Desarrollo' },
  { id: 'supervision', label: 'Supervisión' },
]

const ROL_COLORS: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700',
  Supervisor: 'bg-blue-100 text-blue-700',
  Operador: 'bg-green-100 text-green-700',
  Consulta: 'bg-gray-100 text-gray-600',
  Autoridad: 'bg-gov-cyan/15 text-gov-blue',
}

function UsuarioModal({
  usuario,
  onClose,
  onSave,
  saving,
}: {
  usuario: PortalUsuario | null
  onClose: () => void
  onSave: (payload: UsuarioPayload) => void
  saving: boolean
}) {
  const isEdit = !!usuario
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [rol, setRol] = useState<string>(usuario?.rol ?? 'Operador')
  const [secretarias, setSecretarias] = useState<string[]>(usuario?.secretarias ?? [])
  const [activo, setActivo] = useState(usuario?.activo ?? true)
  const [areas, setAreas] = useState<AreaAcceso[]>(usuario?.areas ?? [])
  const { data: catalogoAreas = {} } = useCatalogoAreas()

  function toggleSecretaria(id: string) {
    setSecretarias((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
    // Las áreas de una secretaría quitada se van con ella (igual que en el backend).
    setAreas((prev) => prev.filter((a) => a.secretaria !== id))
  }

  function nivelDe(secretaria: string, area: string): NivelArea | null {
    return areas.find((a) => a.secretaria === secretaria && a.area === area)?.nivel ?? null
  }

  function setNivel(secretaria: string, area: string, nivel: NivelArea | null) {
    setAreas((prev) => [
      ...prev.filter((a) => !(a.secretaria === secretaria && a.area === area)),
      ...(nivel ? [{ secretaria, area, nivel }] : []),
    ])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ email: isEdit ? undefined : email, nombre: nombre || undefined, rol, secretarias, areas, activo })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gov-navy text-white px-5 py-4 rounded-t-lg flex items-center justify-between">
          <h3 className="font-semibold">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                placeholder="usuario@gmail.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                El usuario debe poder iniciar sesión con Google con esta cuenta.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
              placeholder="Nombre y apellido"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                  {r === 'Admin' && ' — acceso total'}
                  {r === 'Supervisor' && ' — ver, editar, crear y eliminar'}
                  {r === 'Operador' && ' — ver, editar y crear'}
                  {r === 'Consulta' && ' — solo lectura'}
                  {r === 'Autoridad' && ' — lectura consolidada de todas las áreas (Resumen Territorial)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Secretarías asignadas
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SECRETARIAS.map((sec) => (
                <label
                  key={sec.id}
                  className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gov-navy"
                >
                  <input
                    type="checkbox"
                    checked={secretarias.includes(sec.id)}
                    onChange={() => toggleSecretaria(sec.id)}
                    className="rounded border-gray-300 text-gov-cyan focus:ring-gov-cyan"
                  />
                  {sec.label}
                </label>
              ))}
            </div>
          </div>

          {SECRETARIAS.filter((sec) => secretarias.includes(sec.id) && catalogoAreas[sec.id]?.length).map((sec) => (
            <fieldset key={sec.id} className="border border-slate-200 rounded-md p-3">
              <legend className="px-1 text-xs font-semibold text-gray-700">Áreas de acceso — {sec.label}</legend>
              {rol === 'Admin' ? (
                <p className="text-xs text-gray-500">Admin accede a todas las áreas.</p>
              ) : (
                <div className="space-y-1.5">
                  {catalogoAreas[sec.id].map(({ area, label }) => {
                    const nivel = nivelDe(sec.id, area)
                    return (
                      <div key={area} className="flex items-center gap-3 text-sm text-gray-700">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={nivel !== null}
                            onChange={(e) => setNivel(sec.id, area, e.target.checked ? 'lectura' : null)}
                            className="rounded border-gray-300 text-gov-cyan focus:ring-gov-cyan"
                          />
                          {label}
                        </label>
                        <select
                          aria-label={`Nivel en ${label}`}
                          disabled={nivel === null}
                          value={nivel ?? 'lectura'}
                          onChange={(e) => setNivel(sec.id, area, e.target.value as NivelArea)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-gov-cyan"
                        >
                          <option value="lectura">Ver</option>
                          <option value="edicion">Editar</option>
                        </select>
                      </div>
                    )
                  })}
                  {!areas.some((a) => a.secretaria === sec.id) && (
                    <p className="text-[11px] text-amber-700">Sin áreas marcadas no ve nada de esta secretaría.</p>
                  )}
                  <p className="text-[11px] text-gray-400">"Editar" no da más permisos que el rol: un usuario Consulta solo ve.</p>
                </div>
              )}
            </fieldset>
          ))}

          {isEdit && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="rounded border-gray-300 text-gov-cyan focus:ring-gov-cyan"
                />
                Usuario activo
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-gov-navy text-white rounded hover:bg-gov-navy/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AdminUsuariosPage() {
  const qc = useQueryClient()
  const { data: catalogoAreas = {} } = useCatalogoAreas()
  const [modalUsuario, setModalUsuario] = useState<PortalUsuario | 'nuevo' | null>(null)
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: usuarios = [], isLoading } = useQuery<PortalUsuario[]>({
    queryKey: ['admin-usuarios'],
    queryFn: () => apiClient.get('/api/v1/portal/admin/usuarios').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload: UsuarioPayload) =>
      apiClient.post('/api/v1/portal/admin/usuarios', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setModalUsuario(null)
      setError(null)
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail?.message ?? 'Error al crear el usuario')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ email, payload }: { email: string; payload: UsuarioPayload }) =>
      apiClient.put(`/api/v1/portal/admin/usuarios/${encodeURIComponent(email)}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setModalUsuario(null)
      setError(null)
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail?.message ?? 'Error al actualizar el usuario')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (email: string) =>
      apiClient.delete(`/api/v1/portal/admin/usuarios/${encodeURIComponent(email)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] })
      setConfirmDeleteEmail(null)
      setError(null)
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail?.message ?? 'Error al eliminar el usuario')
      setConfirmDeleteEmail(null)
    },
  })

  function handleSave(payload: UsuarioPayload) {
    setError(null)
    if (modalUsuario === 'nuevo') {
      createMutation.mutate(payload)
    } else if (modalUsuario) {
      const { email: _ignored, ...rest } = payload
      updateMutation.mutate({ email: modalUsuario.email, payload: rest })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gov-navy">Administración de usuarios</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestioná el acceso al sistema por secretaría y rol.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/catalogos-checklist"
            className="text-sm text-gov-navy border border-gray-200 px-4 py-2 rounded hover:bg-slate-50 transition-colors"
          >
            Catálogos Checklist Técnico
          </Link>
          <Link
            to="/admin/localidades-sin-resolver"
            className="text-sm text-gov-navy border border-gray-200 px-4 py-2 rounded hover:bg-slate-50 transition-colors"
          >
            Localidades sin resolver
          </Link>
          <button
            onClick={() => { setModalUsuario('nuevo'); setError(null) }}
            className="bg-gov-navy text-white text-sm px-4 py-2 rounded hover:bg-gov-navy/90 transition-colors"
          >
            + Nuevo usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando usuarios…</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No hay usuarios registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Nombre</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Secretarías</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {usuarios.map((u) => (
                <tr key={u.email} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-gray-800 font-medium max-w-[180px] truncate">
                    {u.email}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {u.nombre ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROL_COLORS[u.rol] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.secretarias.length === 0 ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        u.secretarias.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                          >
                            {SECRETARIAS.find((x) => x.id === s)?.label ?? s}
                            {!!catalogoAreas[s]?.length && u.rol !== 'Admin' && ` · ${(u.areas ?? []).filter((a) => a.secretaria === s).length} áreas`}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmDeleteEmail === u.email ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-red-700">¿Eliminar?</span>
                        <button
                          onClick={() => deleteMutation.mutate(u.email)}
                          disabled={deleteMutation.isPending}
                          className="px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50 transition-colors"
                        >
                          {deleteMutation.isPending ? '...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteEmail(null)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded text-gray-600 hover:bg-slate-50 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => { setModalUsuario(u); setError(null) }}
                          className="text-xs text-gov-cyan hover:text-gov-navy transition-colors font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteEmail(u.email); setError(null) }}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalUsuario !== null && (
        <UsuarioModal
          usuario={modalUsuario === 'nuevo' ? null : modalUsuario}
          onClose={() => { setModalUsuario(null); setError(null) }}
          onSave={handleSave}
          saving={isSaving}
        />
      )}
    </div>
  )
}
