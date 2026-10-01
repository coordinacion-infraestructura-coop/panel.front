import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resumenTerritorialApi } from '../api/resumenTerritorial.api'
import { fetchPrivadaPorLocalidad } from '../api/privadaGestiones'
import { armarFichaMunicipio, fichaMunicipioPdf, fichaMunicipioXlsx } from '../fichaMunicipio'
import { exportarResumenXlsx } from '../exportResumen'
import { VistaProvincia } from '../components/VistaProvincia'
import type {
  ResumenLocalidad,
  ResumenPrograma,
  ResumenSnapshot,
  ResumenTerritorialPayload,
} from '../types/resumenTerritorial.types'
import type { Kpi } from '../../../shared/components/informe/KpiStrip'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import { normalizeDepartamento } from '../../../shared/utils/normalizeName'

// ── Helpers ──────────────────────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? `${iso}T12:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function fmtHaceTiempo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'No tenés permisos para actualizar el resumen.'
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: unknown }).message)
  }
  return fallback
}

const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const AREA_LABEL: Record<string, string> = {
  vivienda: 'Vivienda', privada: 'Sec. Privada', gasifera: 'Sec. Gasífera', gralgob: 'Sec. Gral. de Gobierno',
}
const AREA_DOT_COLOR: Record<string, string> = {
  vivienda: '#01aae3', privada: '#398ebd', gasifera: '#d17612', gralgob: '#172c3f',
}

// ── Badges ───────────────────────────────────────────────────────────────────────

function EstadoBadge({ prog }: { prog: ResumenPrograma }) {
  if (!prog.estado_general_label) {
    return <span className="text-gray-400 text-xs">—</span>
  }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        background: prog.estado_general_bg ?? '#e5e7eb',
        color: prog.estado_general_text_color ?? '#374151',
      }}
    >
      {prog.estado_general_label}
    </span>
  )
}

function ChecklistPill({ prog }: { prog: ResumenPrograma }) {
  if (prog.area === 'privada') return <span className="text-gray-300 text-xs">—</span>
  if (!prog.checklist_iniciado) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
        No iniciado
      </span>
    )
  }
  if (prog.checklist_faltan === 0) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700">
        Completo
      </span>
    )
  }
  const alto = prog.checklist_faltan > 3
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
        alto ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {prog.checklist_faltan} de {prog.checklist_total} faltan
    </span>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────────

type Unidad = 'localidad' | 'departamento'

export function ResumenTerritorialPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: portalUser } = usePortalUser()

  // Ruta propia de la Ficha de Localidad — reemplaza el viejo modal
  // (FichaLocalidadModal). Se manda el departamento actual como query param
  // para que el "← Volver" de la ficha pueda restaurarlo acá.
  function irAFicha(loc: { departamento: string | null; localidad: string }) {
    if (!loc.departamento) return
    navigate(
      `/resumen-territorial/${encodeURIComponent(loc.departamento)}/${encodeURIComponent(loc.localidad)}` +
        `?departamento=${encodeURIComponent(loc.departamento)}`,
    )
  }
  const canActualizar = ['Admin', 'Supervisor', 'Operador', 'Autoridad'].includes(
    portalUser?.rol ?? '',
  )

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['resumen-territorial'],
    queryFn: resumenTerritorialApi.getResumen,
    staleTime: Infinity,
  })

  // E5a / ADR-016: la federación de Privada la hace el backend (svc-vivienda trae
  // las líneas en el snapshot server-side). El merge client-side queda como
  // FALLBACK y está apagado por default — sólo se enciende con
  // VITE_PRIVADA_CLIENT_FEDERATION=true (RE-7: p. ej. si se hace rollback de E5a).
  const federacionCliente = import.meta.env.VITE_PRIVADA_CLIENT_FEDERATION === 'true'
  const puedeVerPrivada =
    federacionCliente &&
    (['Admin', 'Autoridad'].includes(portalUser?.rol ?? '') ||
      (portalUser?.secretarias ?? []).includes('privada'))
  const privadaQuery = useQuery({
    queryKey: ['resumen-territorial-privada'],
    queryFn: fetchPrivadaPorLocalidad,
    enabled: puedeVerPrivada,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const [error, setError] = useState<string | null>(null)
  const actualizarMut = useMutation({
    mutationFn: resumenTerritorialApi.actualizarResumen,
    onSuccess: (data: ResumenSnapshot) => {
      queryClient.setQueryData(['resumen-territorial'], data)
      setError(null)
    },
    onError: (err) => setError(extractErrorMessage(err, 'No se pudo actualizar el resumen.')),
  })

  const [unidad, setUnidad] = useState<Unidad>('localidad')
  // Tabla general (filtros + tabla legado) colapsada por defecto — la vista
  // principal ahora es VistaProvincia (mapa + KPIs), spec §4 Etapa 3.
  const [tablaAbierta, setTablaAbierta] = useState(false)
  const [q, setQ] = useState('')
  // Se inicializa desde ?departamento= si venimos del link "← Volver" de la
  // Ficha de Localidad (ruta propia) — no perder el contexto de dónde se
  // estaba antes de entrar a la ficha.
  const [fDep, setFDep] = useState(() => searchParams.get('departamento') ?? '')
  const [fLoc, setFLoc] = useState('')
  const [fArea, setFArea] = useState('')
  const [fProg, setFProg] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fChecklist, setFChecklist] = useState('')
  // "Visita del gobernador": estar en ATP (área gralgob) implica que el gobernador
  // fue a la localidad y anunció algo — mismo criterio que el badge ATP del resumen.
  const [fVisitaGob, setFVisitaGob] = useState('')

  // Payload efectivo = snapshot de Vivienda (backend) + líneas de Privada (frontend), mergeadas
  // por clave de localidad normalizada.
  const payload = useMemo<ResumenTerritorialPayload | undefined>(() => {
    const base = snapshot?.payload
    if (!base) return undefined
    const priv = privadaQuery.data
    if (!priv || priv.length === 0) return base

    const byKey = new Map<string, ResumenLocalidad>()
    const locs: ResumenLocalidad[] = base.localidades.map((l) => {
      const copia: ResumenLocalidad = { ...l, programas: [...l.programas] }
      byKey.set(`${norm(l.departamento ?? '')}|${norm(l.localidad)}`, copia)
      return copia
    })
    for (const p of priv) {
      const existente = byKey.get(p.key)
      if (existente) {
        existente.programas.push(p.programa)
      } else {
        const nueva: ResumenLocalidad = {
          id_geo: null,
          localidad: p.localidad,
          departamento: p.departamento,
          lat_centro: null,
          lon_centro: null,
          categoria: null,
          poblacion_2022: null,
          viviendas_2022: null,
          transferencias_periodo: null,
          transferencias_total: null,
          transferencias_por_concepto: null,
          transferencias_per_capita: null,
          atp_monto_per_capita: null,
          programas: [p.programa],
        }
        byKey.set(p.key, nueva)
        locs.push(nueva)
      }
    }
    locs.sort(
      (a, b) =>
        (a.departamento ?? '￿').localeCompare(b.departamento ?? '￿', 'es') ||
        a.localidad.localeCompare(b.localidad, 'es'),
    )
    return {
      generado_para_areas: [...new Set([...base.generado_para_areas, 'privada'])],
      total_localidades: locs.length,
      total_programas: locs.reduce((n, l) => n + l.programas.length, 0),
      localidades: locs,
      total_localidades_por_departamento: base.total_localidades_por_departamento,
    }
  }, [snapshot, privadaQuery.data])

  const opciones = useMemo(() => {
    const deps = new Set<string>()
    const progs = new Map<string, string>()
    const estados = new Set<string>()
    const areas = new Set<string>()
    for (const loc of payload?.localidades ?? []) {
      if (loc.departamento) deps.add(loc.departamento)
      for (const p of loc.programas) {
        progs.set(p.programa, p.programa_label)
        areas.add(p.area)
        if (p.estado_general_label) estados.add(p.estado_general_label)
      }
    }
    return {
      deps: [...deps].sort((a, b) => a.localeCompare(b, 'es')),
      progs: [...progs.entries()],
      estados: [...estados].sort((a, b) => a.localeCompare(b, 'es')),
      areas: [...areas],
    }
  }, [payload])

  // El mapa (departamentos_cba.json) y el payload (padrón viv_geo_localidades)
  // pueden variar en tildes/mayúsculas — se resuelve por texto normalizado
  // antes de fijar el filtro, para que el clic en el mapa siempre encuentre
  // su columna real en la tabla (filtro bidireccional, spec §4).
  function seleccionarDepartamentoDesdeMapa(nombreMapa: string) {
    // normalizeDepartamento (no el `norm` de arriba) — el GeoJSON usa grafías
    // distintas al padrón ("GRAL. SAN MARTÍN"/"PTE. ROQUE SAENZ PEÑA" con
    // punto, "GENERAL ROCA" sin abreviar) que `norm` a secas no empareja
    // (bug real 2026-10-01: esos 3 deptos quedaban "sin datos" en el mapa).
    const nq = normalizeDepartamento(nombreMapa)
    const real =
      opciones.deps.find((d) => normalizeDepartamento(d) === nq) ??
      Object.keys(payload?.total_localidades_por_departamento ?? {}).find((d) => normalizeDepartamento(d) === nq) ??
      nombreMapa
    setFDep((actual) => (actual === real ? '' : real))
    setTablaAbierta(true)
  }

  // Localidades para el combobox — si hay departamento elegido, sólo las de ese depto.
  const opcionesLoc = useMemo(() => {
    const set = new Set<string>()
    for (const loc of payload?.localidades ?? []) {
      if (!loc.localidad) continue
      if (fDep && loc.departamento !== fDep) continue
      set.add(loc.localidad)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [payload, fDep])

  // El filtro de localidad sólo aplica si el texto coincide con una opción real
  // (permite escribir parcial sin dejar la tabla vacía).
  const fLocActivo = fLoc && opcionesLoc.includes(fLoc) ? fLoc : ''

  // Si cambia el departamento y la localidad elegida ya no pertenece, se limpia.
  useEffect(() => {
    if (fLoc && !opcionesLoc.includes(fLoc)) setFLoc('')
  }, [fDep])  // eslint-disable-line react-hooks/exhaustive-deps

  // Si se elige una localidad directo (sin haber elegido antes su departamento),
  // completar fDep para que el breadcrumb y el resalte del mapa queden consistentes.
  useEffect(() => {
    if (!fLocActivo || fDep) return
    const real = payload?.localidades.find((l) => l.localidad === fLocActivo)?.departamento
    if (real) setFDep(real)
  }, [fLocActivo])  // eslint-disable-line react-hooks/exhaustive-deps

  // La tabla general sigue colapsada por defecto (no queremos las ~400 localidades
  // juntas en el primer pantallazo) — pero elegir depto/localidad arriba en "Ir a"
  // la descolapsa al toque, para no tener que abrirla a mano después de filtrar.
  useEffect(() => {
    if (fDep || fLocActivo) setTablaAbierta(true)
  }, [fDep, fLocActivo])

  const localidadesFiltradas = useMemo<ResumenLocalidad[]>(() => {
    const nq = norm(q)
    return (payload?.localidades ?? [])
      .filter((loc) => {
        if (fDep && loc.departamento !== fDep) return false
        if (fLocActivo && loc.localidad !== fLocActivo) return false
        if (nq && !norm(`${loc.localidad} ${loc.departamento ?? ''}`).includes(nq)) return false
        // Chequea contra los programas originales de la localidad (no los ya
        // filtrados por fArea/fProg más abajo) — "visitó" es un hecho de la
        // localidad, independiente de qué área/programa esté mostrando la tabla.
        if (fVisitaGob) {
          const visito = loc.programas.some((p) => p.area === 'gralgob')
          if (fVisitaGob === 'si' && !visito) return false
          if (fVisitaGob === 'no' && visito) return false
        }
        return true
      })
      .map((loc) => {
        const progs = loc.programas.filter((p) => {
          if (fArea && p.area !== fArea) return false
          if (fProg && p.programa !== fProg) return false
          if (fEstado && p.estado_general_label !== fEstado) return false
          if (fChecklist === 'con_faltantes' && !(p.area === 'vivienda' && p.checklist_iniciado && p.checklist_faltan > 0))
            return false
          if (fChecklist === 'completo' && !(p.area === 'vivienda' && p.checklist_iniciado && p.checklist_faltan === 0))
            return false
          if (fChecklist === 'no_iniciado' && !(p.area === 'vivienda' && !p.checklist_iniciado)) return false
          return true
        })
        return { ...loc, programas: progs }
      })
      .filter((loc) => loc.programas.length > 0)
  }, [payload, q, fDep, fLocActivo, fArea, fProg, fEstado, fChecklist, fVisitaGob])

  // Denominadores del padrón geográfico (siempre el total real, sin filtrar)
  // para mostrar "413 de 426" en vez de un número pelado — a pedido del
  // usuario (2026-10-01).
  const totalLocalidadesPadron = useMemo(
    () => Object.values(payload?.total_localidades_por_departamento ?? {}).reduce((s, n) => s + n, 0),
    [payload],
  )
  const totalDepartamentosPadron = useMemo(
    () => Object.keys(payload?.total_localidades_por_departamento ?? {}).length,
    [payload],
  )

  const kpis = useMemo<Kpi[]>(() => {
    const progs = localidadesFiltradas.flatMap((l) => l.programas)
    const conFaltantes = progs.filter(
      (p) => p.area === 'vivienda' && p.checklist_iniciado && p.checklist_faltan > 0,
    ).length
    const recientes = progs.filter((p) => {
      if (!p.ultima_comunicacion) return false
      const d = new Date(`${p.ultima_comunicacion.fecha}T12:00`)
      return (Date.now() - d.getTime()) / 86400000 <= 30
    }).length
    const deps = new Set(localidadesFiltradas.map((l) => l.departamento).filter(Boolean)).size
    return [
      { value: `${localidadesFiltradas.length} de ${totalLocalidadesPadron}`, label: 'Localidades' },
      { value: progs.length, label: 'Programas activos', accent: 'cyan' },
      { value: conFaltantes, label: 'Con ítems faltantes', accent: 'red' },
      { value: recientes, label: 'Comunicaciones · 30 días', accent: 'green' },
      { value: `${deps} de ${totalDepartamentosPadron}`, label: 'Departamentos', accent: 'navy' },
    ]
  }, [localidadesFiltradas, totalLocalidadesPadron, totalDepartamentosPadron])

  // Rollup por departamento (client-side, sobre el mismo payload filtrado)
  const porDepartamento = useMemo(() => {
    const map = new Map<
      string,
      { departamento: string; localidades: number; porPrograma: Map<string, Map<string, number>>; faltan: number; ultima: string | null }
    >()
    for (const loc of localidadesFiltradas) {
      const dep = loc.departamento ?? 'Sin departamento'
      if (!map.has(dep)) {
        map.set(dep, { departamento: dep, localidades: 0, porPrograma: new Map(), faltan: 0, ultima: null })
      }
      const agg = map.get(dep)!
      agg.localidades += 1
      for (const p of loc.programas) {
        if (!agg.porPrograma.has(p.programa_label)) agg.porPrograma.set(p.programa_label, new Map())
        const estMap = agg.porPrograma.get(p.programa_label)!
        const est = p.estado_general_label ?? 'Sin estado'
        estMap.set(est, (estMap.get(est) ?? 0) + 1)
        agg.faltan += p.area === 'vivienda' && p.checklist_iniciado ? p.checklist_faltan : 0
        const f = p.ultima_comunicacion?.fecha ?? null
        if (f && (!agg.ultima || f > agg.ultima)) agg.ultima = f
      }
    }
    return [...map.values()].sort((a, b) => a.departamento.localeCompare(b.departamento, 'es'))
  }, [localidadesFiltradas])

  const alcance = payload?.generado_para_areas.map((a) => AREA_LABEL[a] ?? a).join(' + ') || '—'

  const hayFiltros = q || fDep || fLocActivo || fArea || fProg || fEstado || fChecklist || fVisitaGob
  const limpiar = () => {
    setQ('')
    setFDep('')
    setFLoc('')
    setFArea('')
    setFProg('')
    setFEstado('')
    setFChecklist('')
    setFVisitaGob('')
  }

  // Un único export: .xlsx multi-hoja con los municipios que cumplen los filtros
  // (Programas · Checklists · Gestiones · Movimientos). Ver exportResumen.ts.
  const [exportando, setExportando] = useState(false)
  const [exportAviso, setExportAviso] = useState<string | null>(null)
  const filtrosTexto = [
    q && `texto “${q}”`,
    fDep && `departamento ${fDep}`,
    fLocActivo && `localidad ${fLocActivo}`,
    fArea && `área ${AREA_LABEL[fArea] ?? fArea}`,
    fProg && `programa ${opciones.progs.find(([id]) => id === fProg)?.[1] ?? fProg}`,
    fEstado && `estado ${fEstado}`,
    fChecklist && `checklist ${fChecklist}`,
    fVisitaGob && `visita del gobernador ${fVisitaGob === 'si' ? 'SÍ' : 'NO'}`,
  ].filter(Boolean).join(' · ')
  const incluirPrivada = localidadesFiltradas.some((l) => l.programas.some((p) => p.area === 'privada'))

  async function exportarExcel() {
    if (exportando) return
    setExportando(true)
    setExportAviso(null)
    try {
      const aviso = await exportarResumenXlsx(localidadesFiltradas, {
        alcance,
        filtros: filtrosTexto,
        incluirPrivada,
      })
      setExportAviso(aviso)
    } catch {
      setExportAviso('No se pudo generar el Excel. Reintentá.')
    } finally {
      setExportando(false)
    }
  }

  // ── Ficha de municipio (imprimible) ──────────────────────────────────────
  const [fichaBusy, setFichaBusy] = useState<null | 'pdf' | 'xlsx'>(null)
  const [fichaError, setFichaError] = useState<string | null>(null)
  const municipioSel = fLocActivo
    ? { localidad: fLocActivo, departamento: (payload?.localidades.find((l) => l.localidad === fLocActivo)?.departamento) ?? fDep }
    : null

  async function generarFicha(fmt: 'pdf' | 'xlsx') {
    if (!municipioSel || fichaBusy) return
    setFichaBusy(fmt)
    setFichaError(null)
    try {
      const loc = payload?.localidades.find((l) => l.localidad === municipioSel.localidad)
      const f = await armarFichaMunicipio(municipioSel.departamento ?? '', municipioSel.localidad, loc)
      if (fmt === 'pdf') await fichaMunicipioPdf(f)
      else fichaMunicipioXlsx(f)
    } catch {
      setFichaError('No se pudo generar la ficha. Reintentá.')
    } finally {
      setFichaBusy(null)
    }
  }

  return (
    <div>
      <div>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gov-navy">Resumen Territorial</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Programas y gestiones por localidad — Secretaría General de Gobierno
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {canActualizar && (
              <button
                onClick={() => actualizarMut.mutate()}
                disabled={actualizarMut.isPending}
                className="bg-gov-navy text-white text-sm px-4 py-2 rounded hover:bg-gov-navy/90 disabled:opacity-50"
              >
                {actualizarMut.isPending ? 'Calculando…' : '🔄 Actualizar'}
              </button>
            )}
            {snapshot && (
              <span className="text-[11px] text-gray-400">
                Actualizado {fmtHaceTiempo(snapshot.computed_at)}
                {snapshot.computed_by ? ` · ${snapshot.computed_by}` : ''}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {isLoading && <div className="text-sm text-gray-400 py-10 text-center">Cargando…</div>}

        {!isLoading && !snapshot && (
          <div className="bg-white rounded-lg border border-slate-200 px-6 py-12 text-center">
            <p className="text-gray-500 text-sm mb-4">Todavía no se calculó ningún resumen.</p>
            {canActualizar && (
              <button
                onClick={() => actualizarMut.mutate()}
                disabled={actualizarMut.isPending}
                className="bg-gov-cyan text-white text-sm px-5 py-2.5 rounded hover:bg-gov-cyan/90 disabled:opacity-50"
              >
                {actualizarMut.isPending ? 'Calculando…' : 'Calcular ahora'}
              </button>
            )}
          </div>
        )}

        {payload && payload.localidades.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-6 text-center text-sm text-amber-800">
            Tu área no tiene todavía un servicio conectado a este panel. Cuando lo tenga, vas a ver
            acá el resumen de tus programas por localidad.
          </div>
        )}

        {payload && payload.localidades.length > 0 && (
          <div className="space-y-4">
            {/* Búsqueda + Por Localidad/Por Departamento — arriba de todo (debajo
                del título), a pedido del usuario. Ya no dependen de la tabla
                general abierta: ambos alimentan el "Resumen de la tabla general"
                dentro de VistaProvincia, que ahora siempre está visible. */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
              <div className="relative flex-1 min-w-[220px] max-w-xl">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  🔍
                </span>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por localidad o departamento…"
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-gov-cyan/40 focus:border-gov-cyan"
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="inline-flex bg-slate-100 border border-slate-300 rounded-lg p-0.5">
                {(['localidad', 'departamento'] as Unidad[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnidad(u)}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      unidad === u ? 'bg-gov-cyan text-white' : 'text-gray-600'
                    }`}
                  >
                    Por {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Breadcrumb de navegación — nivel Departamento/Localidad reusa los
                filtros existentes (fDep/fLocActivo) como estado, spec §4 Etapa 3. */}
            <nav className="flex items-center gap-1.5 text-sm">
              <button
                onClick={() => {
                  setFDep('')
                  setFLoc('')
                }}
                className={fDep ? 'text-gov-blue hover:underline' : 'text-gov-navy font-semibold cursor-default'}
              >
                Córdoba
              </button>
              {fDep && (
                <>
                  <span className="text-gray-300">›</span>
                  <button
                    onClick={() => setFLoc('')}
                    className={fLocActivo ? 'text-gov-blue hover:underline' : 'text-gov-navy font-semibold cursor-default'}
                  >
                    {fDep}
                  </button>
                </>
              )}
              {fLocActivo && (
                <>
                  <span className="text-gray-300">›</span>
                  <span className="text-gov-navy font-semibold">{fLocActivo}</span>
                </>
              )}
            </nav>

            {/* Ir a: departamento/localidad — controla el mapa (zoom + resalte) y la
                tabla de abajo a la vez, no solo la tabla (feedback QA visual Etapa 3). */}
            <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1">
                Ir a
              </span>
              <select
                value={fDep}
                onChange={(e) => setFDep(e.target.value)}
                className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5"
              >
                <option value="">Toda la provincia</option>
                {opciones.deps.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input
                list="rt-loc-list"
                value={fLoc}
                onChange={(e) => setFLoc(e.target.value)}
                placeholder={fDep ? `Localidad de ${fDep}…` : 'Localidad…'}
                className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 min-w-[170px]"
              />
              <datalist id="rt-loc-list">
                {opcionesLoc.map((l) => <option key={l} value={l} />)}
              </datalist>
              {fLocActivo && (
                <button
                  onClick={() => {
                    const loc = payload?.localidades.find((l) => l.localidad === fLocActivo)
                    if (loc) irAFicha(loc)
                  }}
                  className="text-xs bg-gov-cyan text-white font-semibold rounded px-3 py-1.5"
                >
                  Ver ficha completa →
                </button>
              )}
              {(fDep || fLocActivo) && (
                <button
                  onClick={() => {
                    setFDep('')
                    setFLoc('')
                  }}
                  className="text-xs text-gov-blue"
                >
                  ✕ Volver a la provincia
                </button>
              )}
            </div>

            <VistaProvincia
              payload={payload}
              departamentoSeleccionado={fDep || null}
              onSelectDepartamento={seleccionarDepartamentoDesdeMapa}
              kpisTabla={kpis}
              localidadesFiltradas={localidadesFiltradas}
            />

            <button
              onClick={() => setTablaAbierta((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gov-navy hover:text-gov-blue"
            >
              <span className={`inline-block transition-transform ${tablaAbierta ? 'rotate-90' : ''}`}>›</span>
              Tabla general {fDep ? `— ${fDep}` : '(todas las localidades)'}
            </button>

            {tablaAbierta && (
            <>
            {/* Toolbar (búsqueda y Por Localidad/Departamento viven arriba, junto al título) */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-gray-500">
                Alcance: <strong className="text-gov-navy">{alcance}</strong>
                {puedeVerPrivada && privadaQuery.isLoading && (
                  <span className="text-gray-400"> · cargando Privada…</span>
                )}
                {puedeVerPrivada && privadaQuery.isError && (
                  <span className="text-amber-600"> · Privada no disponible</span>
                )}
              </span>
              <div className="ml-auto flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => generarFicha('pdf')}
                  disabled={!municipioSel || fichaBusy !== null}
                  title={municipioSel ? `Ficha de ${municipioSel.localidad}` : 'Elegí una localidad para generar su ficha'}
                  className="text-sm bg-gov-navy text-white rounded px-3 py-1.5 hover:bg-gov-blue disabled:opacity-40"
                >
                  {fichaBusy === 'pdf' ? 'Generando…' : '📄 Ficha de municipio (PDF)'}
                </button>
                <button
                  onClick={() => generarFicha('xlsx')}
                  disabled={!municipioSel || fichaBusy !== null}
                  className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:border-gov-cyan hover:text-gov-blue disabled:opacity-40"
                >
                  {fichaBusy === 'xlsx' ? '…' : 'Ficha (Excel)'}
                </button>
                <span className="w-px h-5 bg-slate-200" />
                <button
                  onClick={exportarExcel}
                  disabled={exportando}
                  title="Exporta los municipios que cumplen los filtros: programas, checklists, gestiones y movimientos"
                  className="text-sm bg-gov-cyan text-white rounded px-3 py-1.5 hover:brightness-105 disabled:opacity-50"
                >
                  {exportando ? 'Generando…' : '⤓ Exportar Excel'}
                </button>
              </div>
            </div>
            {fichaError && <p className="text-xs text-red-600">{fichaError}</p>}
            {exportAviso && <p className="text-xs text-amber-600">{exportAviso}</p>}

            {/* Filtros (departamento/localidad viven arriba, junto al mapa) */}
            <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1">
                Filtros
              </span>
              {opciones.areas.length > 1 && (
                <select value={fArea} onChange={(e) => setFArea(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                  <option value="">Todas las áreas</option>
                  {opciones.areas.map((a) => (
                    <option key={a} value={a}>
                      {AREA_LABEL[a] ?? a}
                    </option>
                  ))}
                </select>
              )}
              <select value={fProg} onChange={(e) => setFProg(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Todos los programas</option>
                {opciones.progs.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Cualquier estado</option>
                {opciones.estados.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <select value={fChecklist} onChange={(e) => setFChecklist(e.target.value)} className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
                <option value="">Checklist: cualquiera</option>
                <option value="con_faltantes">Con ítems faltantes</option>
                <option value="completo">Completo</option>
                <option value="no_iniciado">No iniciado</option>
              </select>
              <select
                value={fVisitaGob}
                onChange={(e) => setFVisitaGob(e.target.value)}
                title="Estar en ATP (Sec. Gral. de Gobierno) implica que el gobernador visitó la localidad y anunció algo"
                className="text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5"
              >
                <option value="">Visita del gobernador: cualquiera</option>
                <option value="si">Visita del gobernador: SÍ</option>
                <option value="no">Visita del gobernador: NO</option>
              </select>
              {hayFiltros && (
                <button onClick={limpiar} className="text-xs text-gov-blue">
                  ✕ Limpiar
                </button>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {unidad === 'localidad'
                  ? `${localidadesFiltradas.length} localidades`
                  : `${porDepartamento.length} departamentos`}
              </span>
            </div>

            {/* Tabla */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              {unidad === 'localidad' ? (
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 w-[200px]">Localidad</th>
                      <th className="text-left px-4 py-2.5">
                        Programas · estado · checklist · última comunicación
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {localidadesFiltradas.map((loc, i) => (
                      <tr
                        key={i}
                        onClick={() => irAFicha(loc)}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer align-top"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm text-gov-navy">{loc.localidad}</div>
                          <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                            {loc.departamento ?? 'Sin departamento'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            {loc.programas.map((p, j) => (
                              <div
                                key={j}
                                className="grid grid-cols-[160px_auto_1fr_auto] gap-2.5 items-center max-[720px]:grid-cols-2"
                              >
                                <span className="text-xs font-semibold text-gov-navy flex items-center gap-1.5">
                                  <span
                                    className="w-1.5 h-1.5 rounded-sm"
                                    style={{ background: AREA_DOT_COLOR[p.area] ?? '#01aae3' }}
                                  />
                                  {p.programa_label}
                                </span>
                                <EstadoBadge prog={p} />
                                <ChecklistPill prog={p} />
                                <span className="text-[11px] text-gray-500 text-right">
                                  {p.ultima_comunicacion ? (
                                    <>
                                      <span className="font-semibold text-gov-navy">
                                        {fmtDate(p.ultima_comunicacion.fecha)}
                                      </span>
                                      {p.ultima_comunicacion.area
                                        ? ` · ${p.ultima_comunicacion.area}`
                                        : ''}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {localidadesFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-10 text-center text-sm text-gray-400">
                          Sin resultados con los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 w-[200px]">Departamento</th>
                      <th className="text-left px-4 py-2.5">Consolidado por programa</th>
                      <th className="text-left px-4 py-2.5 w-[130px]">Últ. comunicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDepartamento.map((d, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm text-gov-navy">{d.departamento}</div>
                          <div className="text-[11px] text-gray-400">
                            {d.localidades} localidad{d.localidades !== 1 ? 'es' : ''} ·{' '}
                            {d.faltan} ítems faltan
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {[...d.porPrograma.entries()].map(([prog, estMap]) => (
                              <div key={prog} className="text-xs flex flex-wrap gap-1.5 items-center">
                                <span className="font-semibold text-gov-navy min-w-[130px]">
                                  {prog}
                                </span>
                                {[...estMap.entries()].map(([est, n]) => (
                                  <span
                                    key={est}
                                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                                  >
                                    {est} · {n}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-500">{fmtDate(d.ultima)}</td>
                      </tr>
                    ))}
                    {porDepartamento.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                          Sin resultados con los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              Datos del último snapshot consolidado (svc-vivienda + Sec. Privada). Se recalcula con
              el botón “Actualizar” y automáticamente por tarea programada.
            </p>
            </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
