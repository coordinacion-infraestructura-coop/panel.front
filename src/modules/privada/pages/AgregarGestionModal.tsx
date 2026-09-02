import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gestionesApi } from '../api/gestiones.api'
import { CatalogoEditableSelect } from './CatalogoEditableSelect'
import type { CatalogoItem, GestionCreatePayload, MeResponse, OkEstado } from '../types/gestiones.types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

const URGENCIAS = ['Alta', 'Media', 'Baja']
const OK_OPCIONES: OkEstado[] = ['PENDIENTE', 'SI', 'NO']

function extractError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] }
    if (first?.msg) return `${first.msg}${first.loc ? ` (${first.loc.join('.')})` : ''}`
  }
  if (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string') {
    return (detail as { message: string }).message
  }
  return 'No se pudo crear la gestión. Revisá los datos e intentá de nuevo.'
}

const emptyForm = {
  ministerio_agencia_id: '',
  categoria_general_id: '',
  urgencia: 'Media',
  tipo_gestion: '',
  canal_origen: '',
  departamento: '',
  localidad: '',
  direccion: '',
  detalle: '',
  observaciones: '',
  organismo_id: '',
  subtipo_detalle: '',
  costo_estimado: '',
  costo_moneda: 'ARS',
  nro_expediente: '',
}

export function AgregarGestionModal({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...emptyForm })
  const [error, setError] = useState<string | null>(null)
  // E1/E2 — catálogos editables + Ok Gob/Min (fuera de `form` por ser numéricos/enum)
  const [catId, setCatId] = useState<number | null>(null)
  const [progId, setProgId] = useState<number | null>(null)
  const [areaId, setAreaId] = useState<number | null>(null)
  const [okGob, setOkGob] = useState<OkEstado>('PENDIENTE')
  const [okMin, setOkMin] = useState<OkEstado>('PENDIENTE')

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['privada-me'],
    queryFn: () => gestionesApi.me(),
    staleTime: Infinity,
  })
  const puedeCrearCat = me?.rol === 'Admin' || me?.rol === 'Supervisor'

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm })
      setError(null)
      setCatId(null); setProgId(null); setAreaId(null)
      setOkGob('PENDIENTE'); setOkMin('PENDIENTE')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value, ...(key === 'departamento' ? { localidad: '' } : {}) }))
  }

  const { data: ministerios } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-ministerios'],
    queryFn: () => gestionesApi.catalogo('ministerios'),
    staleTime: Infinity,
  })
  const { data: categorias } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-categorias'],
    queryFn: () => gestionesApi.catalogo('categorias'),
    staleTime: Infinity,
  })
  const { data: tiposGestion } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-tipos-gestion'],
    queryFn: () => gestionesApi.catalogo('tipos-gestion'),
    staleTime: Infinity,
  })
  const { data: canalesOrigen } = useQuery<CatalogoItem[]>({
    queryKey: ['privada-cat-canales-origen'],
    queryFn: () => gestionesApi.catalogo('canales-origen'),
    staleTime: Infinity,
  })
  const { data: departamentos } = useQuery<string[]>({
    queryKey: ['privada-cat-departamentos'],
    queryFn: () => gestionesApi.catalogo('departamentos'),
    staleTime: Infinity,
  })
  const { data: localidades } = useQuery<string[]>({
    queryKey: ['privada-cat-localidades', form.departamento],
    queryFn: () => gestionesApi.catalogoLocalidades(form.departamento),
    enabled: open && !!form.departamento,
    staleTime: Infinity,
  })

  const mutation = useMutation({
    mutationFn: (payload: GestionCreatePayload) => gestionesApi.crear(payload),
    onSuccess: (res: { id_gestion?: string }) => {
      qc.invalidateQueries({ queryKey: ['gestiones'] })
      onClose()
      if (res?.id_gestion) onCreated?.(res.id_gestion)
    },
    onError: (err: unknown) => setError(extractError(err)),
  })

  const canSubmit =
    !!form.ministerio_agencia_id &&
    !!form.categoria_general_id &&
    !!form.departamento &&
    !!form.localidad &&
    form.detalle.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || mutation.isPending) return
    setError(null)
    const trimmed = (s: string) => (s.trim() === '' ? undefined : s.trim())
    const payload: GestionCreatePayload = {
      ministerio_agencia_id: form.ministerio_agencia_id,
      categoria_general_id: form.categoria_general_id,
      detalle: form.detalle.trim(),
      departamento: form.departamento,
      localidad: form.localidad,
      urgencia: form.urgencia || 'Media',
      direccion: trimmed(form.direccion),
      observaciones: trimmed(form.observaciones),
      tipo_gestion: trimmed(form.tipo_gestion),
      canal_origen: trimmed(form.canal_origen),
      organismo_id: trimmed(form.organismo_id),
      subtipo_detalle: trimmed(form.subtipo_detalle),
      costo_estimado: form.costo_estimado.trim() === '' ? undefined : Number(form.costo_estimado),
      costo_moneda: trimmed(form.costo_moneda),
      nro_expediente: trimmed(form.nro_expediente),
      categoria_id: catId,
      programa_id: progId,
      area_id: areaId,
      ok_gobernador: okGob,
      ok_ministro: okMin,
    }
    mutation.mutate(payload)
  }

  if (!open) return null

  const inputCls =
    'w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-cyan bg-white disabled:bg-slate-50 disabled:text-slate-400'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-0 z-60 flex items-start justify-center p-4 overflow-y-auto pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Nueva gestión"
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 pointer-events-auto">
          <div className="bg-gov-navy text-white px-5 py-4 rounded-t-xl flex items-center justify-between sticky top-0">
            <h2 className="font-semibold">Nueva gestión</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} htmlFor="ng-ministerio">
                  Ministerio / Agencia <span className="text-red-500">*</span>
                </label>
                <select id="ng-ministerio" className={inputCls} value={form.ministerio_agencia_id}
                  onChange={(e) => set('ministerio_agencia_id', e.target.value)} required>
                  <option value="">(Seleccionar)</option>
                  {(ministerios ?? []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-categoria">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select id="ng-categoria" className={inputCls} value={form.categoria_general_id}
                  onChange={(e) => set('categoria_general_id', e.target.value)} required>
                  <option value="">(Seleccionar)</option>
                  {(categorias ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-urgencia">Urgencia</label>
                <select id="ng-urgencia" className={inputCls} value={form.urgencia}
                  onChange={(e) => set('urgencia', e.target.value)}>
                  {URGENCIAS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-nroexp">Nro expediente</label>
                <input id="ng-nroexp" type="text" className={inputCls} value={form.nro_expediente}
                  onChange={(e) => set('nro_expediente', e.target.value)} placeholder="Opcional" />
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-tipo">Tipo de gestión</label>
                <select id="ng-tipo" className={inputCls} value={form.tipo_gestion}
                  onChange={(e) => set('tipo_gestion', e.target.value)}>
                  <option value="">(Sin especificar)</option>
                  {(tiposGestion ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-canal">Canal de origen</label>
                <select id="ng-canal" className={inputCls} value={form.canal_origen}
                  onChange={(e) => set('canal_origen', e.target.value)}>
                  <option value="">(Sin especificar)</option>
                  {(canalesOrigen ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-depto">
                  Departamento <span className="text-red-500">*</span>
                </label>
                <select id="ng-depto" className={inputCls} value={form.departamento}
                  onChange={(e) => set('departamento', e.target.value)} required>
                  <option value="">(Seleccionar)</option>
                  {(departamentos ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="ng-localidad">
                  Localidad <span className="text-red-500">*</span>
                </label>
                <select id="ng-localidad" className={inputCls} value={form.localidad}
                  onChange={(e) => set('localidad', e.target.value)} disabled={!form.departamento} required>
                  <option value="">{form.departamento ? '(Seleccionar)' : 'Elegí un departamento primero'}</option>
                  {(localidades ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="ng-direccion">Dirección</label>
              <input id="ng-direccion" type="text" className={inputCls} value={form.direccion}
                onChange={(e) => set('direccion', e.target.value)} placeholder="Opcional" />
            </div>

            <div>
              <label className={labelCls} htmlFor="ng-detalle">
                Detalle <span className="text-red-500">*</span>
              </label>
              <textarea id="ng-detalle" rows={3} className={`${inputCls} resize-none`} value={form.detalle}
                onChange={(e) => set('detalle', e.target.value)} required
                placeholder="Descripción de la gestión…" />
            </div>

            <div>
              <label className={labelCls} htmlFor="ng-obs">Observaciones</label>
              <textarea id="ng-obs" rows={2} className={`${inputCls} resize-none`} value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)} placeholder="Opcional" />
            </div>

            {/* E1 — Campo de Trabajo / Programa asociado / Área (desplegables editables) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <CatalogoEditableSelect nombre="categorias" label="Campo de Trabajo" value={catId} onChange={setCatId} puedeCrear={puedeCrearCat} />
              <CatalogoEditableSelect nombre="programas" label="Programa asociado" value={progId} onChange={setProgId} puedeCrear={puedeCrearCat} />
              <CatalogoEditableSelect nombre="areas" label="Área" value={areaId} onChange={setAreaId} puedeCrear={puedeCrearCat} />
            </div>

            {/* E2 — Ok Gobernador / Ok Ministro */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Ok Gobernador</label>
                <select className={inputCls} value={okGob} onChange={(e) => setOkGob(e.target.value as OkEstado)}>
                  {OK_OPCIONES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ok Ministro</label>
                <select className={inputCls} value={okMin} onChange={(e) => setOkMin(e.target.value as OkEstado)}>
                  {OK_OPCIONES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <details className="border border-slate-200 rounded">
              <summary className="px-3 py-2 text-sm text-slate-600 cursor-pointer select-none">
                Datos adicionales
              </summary>
              <div className="p-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="ng-organismo">Organismo</label>
                  <input id="ng-organismo" type="text" className={inputCls} value={form.organismo_id}
                    onChange={(e) => set('organismo_id', e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ng-subtipo">Subtipo / detalle</label>
                  <input id="ng-subtipo" type="text" className={inputCls} value={form.subtipo_detalle}
                    onChange={(e) => set('subtipo_detalle', e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ng-costo">Costo estimado</label>
                  <input id="ng-costo" type="number" min="0" step="0.01" className={inputCls} value={form.costo_estimado}
                    onChange={(e) => set('costo_estimado', e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ng-moneda">Moneda</label>
                  <input id="ng-moneda" type="text" className={inputCls} value={form.costo_moneda}
                    onChange={(e) => set('costo_moneda', e.target.value)} />
                </div>
              </div>
            </details>

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded text-sm hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={!canSubmit || mutation.isPending}
                className="flex-1 bg-gov-navy text-white py-2 rounded text-sm hover:bg-gov-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {mutation.isPending ? 'Creando…' : 'Crear gestión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
