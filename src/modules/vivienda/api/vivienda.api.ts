import apiClient from '../../../shared/api/client'
import type {
  Programa,
  Beneficiario,
  BeneficiarioCreate,
  Expediente,
  CordonCunetaPanel,
  MunicipioCC,
  MunicipioCCUpdate,
  PedidoCC,
  PedidoCCCreate,
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

  updateMunicipio: (id: string, data: MunicipioCCUpdate) =>
    apiClient.patch<MunicipioCC>(`${BASE}/cordon-cuneta/${id}`, data).then((r) => r.data),

  updatePresupuesto: (presupuesto: number) =>
    apiClient.patch<number>(`${BASE}/cordon-cuneta-config/presupuesto`, { presupuesto }).then((r) => r.data),

  getPedidos: (municipioId: string) =>
    apiClient.get<PedidoCC[]>(`${BASE}/cordon-cuneta/${municipioId}/pedidos`).then((r) => r.data),

  createPedido: (municipioId: string, data: PedidoCCCreate) =>
    apiClient.post<PedidoCC>(`${BASE}/cordon-cuneta/${municipioId}/pedidos`, data).then((r) => r.data),

  deletePedido: (municipioId: string, pedidoId: string) =>
    apiClient.delete(`${BASE}/cordon-cuneta/${municipioId}/pedidos/${pedidoId}`).then((r) => r.data),
}
