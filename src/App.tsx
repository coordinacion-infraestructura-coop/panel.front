import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './shared/auth/AuthContext'
import { ProtectedRoute } from './shared/auth/ProtectedRoute'
import { Layout } from './shared/components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProgramasPage } from './modules/vivienda/pages/ProgramasPage'
import { BeneficiariosListPage } from './modules/vivienda/pages/BeneficiariosListPage'
import { BeneficiarioFormPage } from './modules/vivienda/pages/BeneficiarioFormPage'
import { ExpedientesListPage } from './modules/vivienda/pages/ExpedientesListPage'
import { CordonCunetaPage } from './modules/vivienda/pages/CordonCunetaPage'
import { GestionesListPage } from './modules/privada/pages/GestionesListPage'
import { TableroPage } from './modules/privada/pages/TableroPage'
import { AdminUsuariosPage } from './modules/admin/pages/AdminUsuariosPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="vivienda/programas" element={<ProgramasPage />} />
              <Route path="vivienda/beneficiarios" element={<BeneficiariosListPage />} />
              <Route path="vivienda/beneficiarios/nuevo" element={<BeneficiarioFormPage />} />
              <Route path="vivienda/expedientes" element={<ExpedientesListPage />} />
              <Route path="vivienda/cordon-cuneta" element={<CordonCunetaPage />} />
              <Route path="privada/gestiones" element={<GestionesListPage />} />
              <Route path="privada/tablero" element={<TableroPage />} />
              <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
