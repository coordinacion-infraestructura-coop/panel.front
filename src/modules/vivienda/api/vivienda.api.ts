import apiClient from '../../../shared/api/client'
import type {
  Programa,
  Beneficiario,
  BeneficiarioCreate,
  Expediente,
  CordonCunetaPanel,
  MunicipioCC,
  MunicipioCCUpdate,
  MunicipioCCCreate,
  PedidoCC,
  PedidoCCCreate,
  EstadoCC,
  EstadoCCCreate,
  EstadoCCUpdate,
  EstadoHistorialCC,
  ChecklistTecnicoCC,
  CordobaHogarPanel,
  LocalidadCH,
  LocalidadCHUpdate,
  LocalidadCHCreate,
  PedidoCH,
  PedidoCHCreate,
  EstadoCH,
  EstadoCHCreate,
  EstadoCHUpdate,
  EstadoHistorialCH,
  GeoLocalidad,
} from '../types/vivienda.types'

const BASE = '/api/v1/vivienda'

export const programasApi = {
  list: () => apiClient.get<Programa[]>(`${BASE}/programas`).then((r) => r.data),
}

export const beneficiariosApi = {
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ data: Beneficiario[]; total: number }>(`${BASE}/beneficiarios`, { params })
      .then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<Beneficiario>(`${BASE}/beneficiarios/${id}`).then((r) => r.data),

  buscarPorDni: (dni: string) =>
    apiClient.get<Beneficiario>(`${BASE}/beneficiarios/buscar`, { params: { dni } }).then((r) => r.data),

  create: (data: BeneficiarioCreate) =>
    apiClient.post<Beneficiario>(`${BASE}/beneficiarios`, data).then((r) => r.data),

  update: (id: string, data: Partial<BeneficiarioCreate>) =>
    apiClient.patch<Beneficiario>(`${BASE}/beneficiarios/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`${BASE}/beneficiarios/${id}`).then((r) => r.data),
}

export const expedientesApi = {
  list: (params?: { estado?: string; programa_codigo?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ data: Expediente[]; total: number }>(`${BASE}/expedientes`, { params })
      .then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<Expediente>(`${BASE}/expedientes/${id}`).then((r) => r.data),

  create: (data: { beneficiario_id: string; programa_id: string; observaciones?: string }) =>
    apiClient.post<Expediente>(`${BASE}/expedientes`, data).then((r) => r.data),

  transicion: (id: string, data: { nuevo_estado: string; motivo?: string }) =>
    apiClient.post(`${BASE}/expedientes/${id}/transicion`, data).then((r) => r.data),

  historial: (id: string) =>
    apiClient.get(`${BASE}/expedientes/${id}/historial`).then((r) => r.data),
}

export const cordonCunetaApi = {
  getPanel: () =>
    apiClient.get<CordonCunetaPanel>(`${BASE}/cordon-cuneta`).then((r) => r.data),

  createMunicipio: (data: MunicipioCCCreate) =>
    apiClient.post<MunicipioCC>(`${BASE}/cordon-cuneta`, data).then((r) => r.data),

  updateMunicipio: (id: string, data: MunicipioCCUpdate) =>
    apiClient.patch<MunicipioCC>(`${BASE}/cordon-cuneta/${id}`, data).then((r) => r.data),

  deleteMunicipio: (id: string) =>
    apiClient.delete(`${BASE}/cordon-cuneta/${id}`).then((r) => r.data),

  getHistorial: (municipioId: string) =>
    apiClient.get<EstadoHistorialCC[]>(`${BASE}/cordon-cuneta/${municipioId}/historial`).then((r) => r.data),

  updatePresupuesto: (presupuesto: number) =>
    apiClient.patch<number>(`${BASE}/cordon-cuneta-config/presupuesto`, { presupuesto }).then((r) => r.data),

  getPedidos: (municipioId: string) =>
    apiClient.get<PedidoCC[]>(`${BASE}/cordon-cuneta/${municipioId}/pedidos`).then((r) => r.data),

  createPedido: (municipioId: string, data: PedidoCCCreate) =>
    apiClient.post<PedidoCC>(`${BASE}/cordon-cuneta/${municipioId}/pedidos`, data).then((r) => r.data),

  deletePedido: (municipioId: string, pedidoId: string) =>
    apiClient.delete(`${BASE}/cordon-cuneta/${municipioId}/pedidos/${pedidoId}`).then((r) => r.data),

  // Estado catalog management (Supervisor+)
  createEstado: (data: EstadoCCCreate) =>
    apiClient.post<EstadoCC>(`${BASE}/cordon-cuneta/estados`, data).then((r) => r.data),

  updateEstado: (id: number, data: EstadoCCUpdate) =>
    apiClient.patch<EstadoCC>(`${BASE}/cordon-cuneta/estados/${id}`, data).then((r) => r.data),

  deleteEstado: (id: number) =>
    apiClient.delete(`${BASE}/cordon-cuneta/estados/${id}`).then((r) => r.data),

  getGeo: () =>
    apiClient.get<GeoLocalidad[]>(`${BASE}/cordon-cuneta/geo`).then((r) => r.data),

  getChecklistTecnico: (municipioId: string) =>
    apiClient
      .get<ChecklistTecnicoCC | null>(`${BASE}/cordon-cuneta/${municipioId}/checklist-tecnico`)
      .then((r) => r.data),
}

export const cordobaHogarApi = {
  getPanel: () =>
    apiClient.get<CordobaHogarPanel>(`${BASE}/cordoba-hogar`).then((r) => r.data),

  createLocalidad: (data: LocalidadCHCreate) =>
    apiClient.post<LocalidadCH>(`${BASE}/cordoba-hogar`, data).then((r) => r.data),

  updateLocalidad: (id: string, data: LocalidadCHUpdate) =>
    apiClient.patch<LocalidadCH>(`${BASE}/cordoba-hogar/${id}`, data).then((r) => r.data),

  deleteLocalidad: (id: string) =>
    apiClient.delete(`${BASE}/cordoba-hogar/${id}`).then((r) => r.data),

  getHistorial: (localidadId: string) =>
    apiClient.get<EstadoHistorialCH[]>(`${BASE}/cordoba-hogar/${localidadId}/historial`).then((r) => r.data),

  updatePresupuesto: (presupuesto: number) =>
    apiClient.patch(`${BASE}/cordoba-hogar-config/presupuesto`, { presupuesto }).then((r) => r.data),

  getPedidos: (localidadId: string) =>
    apiClient.get<PedidoCH[]>(`${BASE}/cordoba-hogar/${localidadId}/pedidos`).then((r) => r.data),

  createPedido: (localidadId: string, data: PedidoCHCreate) =>
    apiClient.post<PedidoCH>(`${BASE}/cordoba-hogar/${localidadId}/pedidos`, data).then((r) => r.data),

  deletePedido: (localidadId: string, pedidoId: string) =>
    apiClient.delete(`${BASE}/cordoba-hogar/${localidadId}/pedidos/${pedidoId}`).then((r) => r.data),

  // Estado catalog management (Supervisor+)
  createEstado: (data: EstadoCHCreate) =>
    apiClient.post<EstadoCH>(`${BASE}/cordoba-hogar/estados`, data).then((r) => r.data),

  updateEstado: (id: number, data: EstadoCHUpdate) =>
    apiClient.patch<EstadoCH>(`${BASE}/cordoba-hogar/estados/${id}`, data).then((r) => r.data),

  deleteEstado: (id: number) =>
    apiClient.delete(`${BASE}/cordoba-hogar/estados/${id}`).then((r) => r.data),

  getGeo: () =>
    apiClient.get<GeoLocalidad[]>(`${BASE}/cordoba-hogar/geo`).then((r) => r.data),

  updateMontoPorCasa: (monto_por_casa: number) =>
    apiClient.patch(`${BASE}/cordoba-hogar-config/monto-por-casa`, { monto_por_casa }).then((r) => r.data),
}
