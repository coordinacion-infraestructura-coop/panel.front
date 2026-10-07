// Estado Técnico de los paneles CC / CH / ML.
// Ya no se carga en cada panel: es el "Estado del expediente" que el área técnica mantiene en
// el Checklist Técnico (docs/files/spec-estado-tecnico-desde-checklist.md). Los tres paneles
// comparten estos helpers porque el catálogo es uno solo para los tres programas.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checklistTecnicoApi } from './api/vivienda.api'
import type { CatalogoEstadoExpediente } from './types/vivienda.types'

// `campo` de las entradas de historial que vienen del checklist (el backend las mezcla con las
// propias del panel). Las `etecnico` a secas son cambios viejos, con ids del catálogo del programa.
export const CAMPO_TECNICO_CHECKLIST = 'etecnico_checklist'

export const LEYENDA_TECNICO = 'Se actualiza desde el Checklist Técnico'

export function useEstadosTecnico(): CatalogoEstadoExpediente[] {
  const { data } = useQuery({
    queryKey: ['checklist-catalogos'],
    queryFn: checklistTecnicoApi.getCatalogos,
  })
  return useMemo(
    () => [...(data?.estados_expediente ?? [])].sort((a, b) => a.orden - b.orden),
    [data],
  )
}

export function tecnicoLabel(id: number | null | undefined, estados: CatalogoEstadoExpediente[]) {
  return estados.find((e) => e.id === id)?.label ?? ''
}

export function tecnicoOrden(id: number | null | undefined, estados: CatalogoEstadoExpediente[]) {
  return estados.find((e) => e.id === id)?.orden ?? null
}

// Aporte del Técnico al % de avance, de 0 a 1: posición del estado dentro de la ruta del
// checklist. Sin estado, o con un estado de excepción (`en_ruta = false`), aporta 0.
export function avanceTecnico(id: number | null | undefined, estados: CatalogoEstadoExpediente[]) {
  const ruta = estados.filter((e) => e.en_ruta)
  const i = ruta.findIndex((e) => e.id === id)
  if (i < 0 || ruta.length < 2) return 0
  return i / (ruta.length - 1)
}

export function TecnicoBadge({ id, estados }: { id: number | null | undefined; estados: CatalogoEstadoExpediente[] }) {
  const e = estados.find((s) => s.id === id)
  if (!e) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-slate-100 text-slate-700">
      {e.label}
    </span>
  )
}

// Reemplaza al selector de Técnico en los modales de edición de los paneles.
export function TecnicoSoloLectura({ id, estados }: { id: number | null | undefined; estados: CatalogoEstadoExpediente[] }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
      <p className="text-xs font-bold uppercase mb-2 text-gov-navy">Técnico</p>
      <TecnicoBadge id={id} estados={estados} />
      <p className="mt-2 text-[11px] leading-tight text-gray-500">{LEYENDA_TECNICO}</p>
    </div>
  )
}
