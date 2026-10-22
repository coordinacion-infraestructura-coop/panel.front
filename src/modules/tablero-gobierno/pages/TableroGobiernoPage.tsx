import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { usePortalUser } from '../../../shared/hooks/usePortalUser'
import { tableroApi } from '../api/tablero.api'
import { FiltrosGobierno } from '../components/FiltrosGobierno'
import { IndicadorFrescura } from '../components/IndicadorFrescura'
import { useFiltrosGobierno } from '../hooks/useFiltrosGobierno'
import { SECCIONES, type SubSeccion } from '../secciones'
import { AtpCompromisosVista } from '../vistas/AtpCompromisosVista'
import { AtpInternoVista } from '../vistas/AtpInternoVista'
import { ComunidadesRegionalesVista } from '../vistas/ComunidadesRegionalesVista'
import { ConveniosVista } from '../vistas/ConveniosVista'
import { FodemeepVista } from '../vistas/FodemeepVista'
import { FondoAmbientalVista } from '../vistas/FondoAmbientalVista'
import { FondoPermanenteVista } from '../vistas/FondoPermanenteVista'
import { FommepVista } from '../vistas/FommepVista'
import type { ContextoTablero } from '../vistas/contexto'
import { EleccionesVista } from '../vistas/EleccionesVista'
import { InicioVista } from '../vistas/InicioVista'
import { IntendentesVista } from '../vistas/IntendentesVista'
import { ObrasVista } from '../vistas/ObrasVista'
import { ResumenVista } from '../vistas/ResumenVista'
import { ReunionesVista } from '../vistas/ReunionesVista'
import { TransferenciasVista } from '../vistas/TransferenciasVista'
import { VisitasGobernadorVista } from '../vistas/VisitasGobernadorVista'
import { VisitasVista } from '../vistas/VisitasVista'

const ANIO_ACTUAL = new Date().getFullYear()

/** Tablero de Gobierno — reemplazo del Looker "Tablero - Min. de Gobierno"
 * (spec-tablero-gobierno-panel.md). Barra común (filtros en la URL, frescura de fuentes) y
 * navegación de secciones; cada pantalla muestra "en preparación" hasta su etapa (Etapa 1:
 * Inicio, Coparticipación, FOFINDES y ATP Compromisos; Etapa 2: Resumen general, FODEMEEP y
 * FOMMEP, y Coparticipación y FOFINDES desde las planillas de Gobierno). */
export function TableroGobiernoPage() {
  const { seccion: seccionId = 'inicio', sub: subId } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { data: portalUser } = usePortalUser()
  const meta = useQuery({ queryKey: ['tablero-gobierno', 'meta'], queryFn: tableroApi.meta, staleTime: 5 * 60_000 })
  const anios = meta.data?.anios ?? [ANIO_ACTUAL]
  const filtros = useFiltrosGobierno(anios[0] ?? ANIO_ACTUAL)

  const seccion = SECCIONES.find((s) => s.id === seccionId)
  if (!seccion) return <Navigate to={`/tablero-gobierno${search}`} replace />
  const sub = seccion.subs.find((s) => s.id === subId) ?? seccion.subs[0]

  const loc = meta.data?.localidades.find((l) => l.codigo_indec === filtros.localidad)
  const contexto = loc ? `${loc.nombre} · ${loc.departamento}` : filtros.departamento ? `Departamento ${filtros.departamento}` : 'Toda la provincia'
  const locsFiltro = meta.data
    ? loc
      ? [loc]
      : filtros.departamento
        ? meta.data.localidades.filter((l) => l.departamento === filtros.departamento)
        : undefined
    : undefined
  const ctx: ContextoTablero = {
    anio: filtros.anio,
    departamento: filtros.departamento,
    localidad: loc,
    codigos: locsFiltro?.map((l) => l.codigo_indec),
    idsGeo: locsFiltro?.flatMap((l) => (l.id_geo ? [l.id_geo] : [])),
    setDepartamento: filtros.setDepartamento,
    irA: (s, sub) => navigate(`/tablero-gobierno/${s}${sub ? `/${sub}` : ''}${search}`),
  }
  const puedeVerFicha =
    portalUser?.rol === 'Autoridad' || (portalUser?.secretarias ?? []).some((s) => s.toLowerCase() === 'supervision')

  const tabCls = (activo: boolean) =>
    `flex-shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan ${
      activo ? 'border-gov-cyan text-gov-navy' : 'border-transparent text-gray-500 hover:text-gov-navy hover:border-slate-300'
    }`

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg px-4 sm:px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gov-navy">Tablero de Gobierno</h2>
            <p className="text-xs text-gray-500 mt-0.5">Transferencias, fondos, gestión territorial y expedientes por localidad · acceso Admin y Autoridad</p>
          </div>
          {meta.data && <IndicadorFrescura fuentes={meta.data.frescura} />}
        </div>
        {meta.isError ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            No pudimos cargar los filtros del tablero. Recargá la página; si sigue, avisá al administrador.
          </p>
        ) : (
          <FiltrosGobierno
            localidades={meta.data?.localidades ?? []}
            anios={anios}
            departamento={filtros.departamento}
            localidad={filtros.localidad}
            anio={filtros.anio}
            setDepartamento={filtros.setDepartamento}
            setLocalidad={filtros.setLocalidad}
            setAnio={filtros.setAnio}
          />
        )}
      </div>

      <nav className="flex overflow-x-auto border-b border-slate-200" aria-label="Secciones del tablero">
        {SECCIONES.map((s) => (
          <Link key={s.id} to={`/tablero-gobierno/${s.id}${search}`} aria-current={s.id === seccion.id ? 'page' : undefined} className={tabCls(s.id === seccion.id)}>
            {s.nombre}
            {s.restringida && <span className="ml-1 text-xs" aria-label="restringida">🔒</span>}
          </Link>
        ))}
      </nav>

      {seccion.subs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Pantallas de ${seccion.nombre}`}>
          {seccion.subs.map((s) => (
            <Link
              key={s.id}
              to={`/tablero-gobierno/${seccion.id}/${s.id}${search}`}
              aria-current={s.id === sub.id ? 'page' : undefined}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gov-cyan ${
                s.id === sub.id ? 'bg-gov-blue border-gov-blue text-white' : 'bg-white border-slate-200 text-gov-navy hover:border-gov-blue'
              }`}
            >
              {s.nombre}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[#e4eef6] border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-gov-navy">
        <span>
          Viendo: <b>{contexto}</b> · {filtros.anio}
        </span>
        {loc && puedeVerFicha && (
          <Link
            to={`/resumen-territorial/${encodeURIComponent(loc.departamento)}/${encodeURIComponent(loc.nombre)}?departamento=${encodeURIComponent(loc.departamento)}`}
            className="text-sm font-medium text-gov-blue hover:underline"
          >
            Abrir Ficha de Localidad →
          </Link>
        )}
      </div>

      {!meta.data && !meta.isError ? (
        <div className="h-40 bg-white border border-slate-200 rounded-lg animate-pulse" aria-label="Cargando" />
      ) : sub.id === 'inicio' ? (
        <InicioVista ctx={ctx} />
      ) : sub.id === 'coparticipacion' || sub.id === 'fofindes' ? (
        <TransferenciasVista key={sub.id} ctx={ctx} seccion={sub.id} />
      ) : sub.id === 'resumen' ? (
        <ResumenVista ctx={ctx} />
      ) : sub.id === 'fodemeep' ? (
        <FodemeepVista ctx={ctx} />
      ) : sub.id === 'fommep' ? (
        <FommepVista ctx={ctx} />
      ) : sub.id === 'atp-compromisos' ? (
        <AtpCompromisosVista ctx={ctx} />
      ) : sub.id === 'atp-interno' ? (
        <AtpInternoVista ctx={ctx} />
      ) : sub.id === 'fondo-permanente' ? (
        <FondoPermanenteVista ctx={ctx} />
      ) : sub.id === 'fondo-ambiental' ? (
        <FondoAmbientalVista ctx={ctx} />
      ) : sub.id === 'comunidades-regionales' ? (
        <ComunidadesRegionalesVista ctx={ctx} />
      ) : sub.id === 'obras' ? (
        <ObrasVista ctx={ctx} />
      ) : sub.id === 'visitas' ? (
        <VisitasVista ctx={ctx} />
      ) : sub.id === 'visitas-gobernador' ? (
        <VisitasGobernadorVista ctx={ctx} />
      ) : sub.id === 'reuniones' ? (
        <ReunionesVista ctx={ctx} />
      ) : sub.id === 'convenios' ? (
        <ConveniosVista ctx={ctx} />
      ) : sub.id === 'intendentes' ? (
        <IntendentesVista ctx={ctx} />
      ) : sub.id === 'elecciones' ? (
        <EleccionesVista ctx={ctx} />
      ) : (
        <EnPreparacion sub={sub} />
      )}
    </div>
  )
}

function EnPreparacion({ sub }: { sub: SubSeccion }) {
  return (
    <section className="bg-white border border-dashed border-slate-300 rounded-lg px-5 py-6">
      <p className="text-[11px] uppercase tracking-widest text-gov-cyan font-semibold">En preparación · {sub.etapa.startsWith('E') ? `Etapa ${sub.etapa}` : sub.etapa}</p>
      <h3 className="text-lg font-semibold text-gov-navy mt-1">
        {sub.nombre}
        {sub.restringida && <span className="ml-2 text-sm">🔒</span>}
      </h3>
      <p className="text-sm text-gray-500 mt-1">Esta pantalla reemplaza a su página del Looker. Va a mostrar:</p>
      <ul className="mt-3 space-y-1.5 text-sm text-gov-navy list-disc pl-5">
        {sub.contenido.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </section>
  )
}
