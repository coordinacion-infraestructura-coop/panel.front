// Agente de consultas (spec-agente-consultas.md, ADR-033). Lo sirve svc-agente bajo
// /api/v1/agente. Solo Admin y Autoridad: el backend responde 403 al resto.

import apiClient from '../../../shared/api/client'
import { auth } from '../../../firebase'

const BASE = '/api/v1/agente'

export interface Conversacion {
  id: string
  titulo: string
  created_at: string
  updated_at: string
}

export type Bloque =
  | { id: string; tipo: 'kpi'; titulo: string; valor: number | string | null; unidad?: string }
  | { id: string; tipo: 'tabla'; titulo: string | null; columnas: string[]; filas: unknown[][]; total_filas: number }
  | { id: string; tipo: 'link'; texto: string; url: string }

export interface Fuente {
  fuente: string
  estado: string
  actualizado: string | null
  refrescado: string | null
}

export interface Respuesta {
  interpretacion: string | null
  bloques: Bloque[]
  fuentes: Fuente[]
  sql: string[]
  sugerencias: string[]
  error?: boolean
}

export interface Mensaje {
  id: string
  rol: 'user' | 'assistant'
  texto: string
  respuesta: Respuesta | null
  created_at: string
}

export interface ConversacionDetalle extends Conversacion {
  mensajes: Mensaje[]
}

export interface RespuestaFinal extends Respuesta {
  mensaje_id: string
  texto: string
}

export const listarConversaciones = (limit = 50) =>
  apiClient
    .get<{ items: Conversacion[]; total: number }>(`${BASE}/conversaciones`, { params: { limit } })
    .then((r) => r.data)

export const crearConversacion = () =>
  apiClient.post<Conversacion>(`${BASE}/conversaciones`, {}).then((r) => r.data)

export const obtenerConversacion = (id: string) =>
  apiClient.get<ConversacionDetalle>(`${BASE}/conversaciones/${id}`).then((r) => r.data)

export const borrarConversacion = (id: string) => apiClient.delete(`${BASE}/conversaciones/${id}`)

export const enviarFeedback = (mensajeId: string, valor: 1 | -1, comentario?: string) =>
  apiClient.post(`${BASE}/mensajes/${mensajeId}/feedback`, { valor, comentario: comentario || null })

export class ErrorAgente extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message)
  }
}

/**
 * Pregunta con Server-Sent Events. Axios no expone el stream en el navegador, por eso `fetch`
 * con el mismo token que pone el interceptor de apiClient.
 */
export async function preguntar(
  conversacionId: string,
  texto: string,
  onProgreso: (texto: string) => void,
  signal?: AbortSignal,
): Promise<RespuestaFinal> {
  const token = await auth.currentUser?.getIdToken()
  const base = apiClient.defaults.baseURL ?? ''
  const res = await fetch(`${base}${BASE}/conversaciones/${conversacionId}/mensajes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ texto }),
    signal,
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new ErrorAgente('Sesión vencida', 401)
  }
  if (!res.ok || !res.body) {
    let detalle: { code?: string; message?: string } = {}
    try {
      detalle = (await res.json())?.detail ?? {}
    } catch {
      /* cuerpo no JSON */
    }
    throw new ErrorAgente(detalle.message ?? `Error ${res.status}`, res.status, detalle.code)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let corte: number
    while ((corte = buffer.indexOf('\n\n')) >= 0) {
      const crudo = buffer.slice(0, corte)
      buffer = buffer.slice(corte + 2)
      // Por líneas y no con regex: `.` y `$` de JS cortan en U+2028/U+2029, que vienen en textos
      // pegados desde Word/Sheets y partían el evento `respuesta` (el usuario reenviaba la pregunta).
      let evento: string | undefined
      const datos: string[] = []
      for (const linea of crudo.split('\n')) {
        if (linea.startsWith('event: ')) evento = linea.slice(7)
        else if (linea.startsWith('data: ')) datos.push(linea.slice(6))
      }
      const data = datos.length ? datos.join('\n') : null
      if (!evento || data == null) continue
      const payload = JSON.parse(data)
      if (evento === 'progreso') onProgreso(payload.texto)
      else if (evento === 'respuesta') return payload as RespuestaFinal
      else if (evento === 'error') throw new ErrorAgente(payload.message, 500, payload.code)
    }
  }
  throw new ErrorAgente('La respuesta se cortó antes de terminar.')
}
