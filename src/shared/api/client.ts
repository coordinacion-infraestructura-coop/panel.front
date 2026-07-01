import axios from 'axios'
import { auth } from '../../firebase'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
