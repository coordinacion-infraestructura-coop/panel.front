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
import { CordobaHogarPage } from './modules/vivienda/pages/CordobaHogarPage'
import { MiLugarPage } from './modules/vivienda/pages/MiLugarPage'
import { ChecklistTecnicoPage } from './modules/vivienda/pages/ChecklistTecnicoPage'
import { TableroAnaliticoPage } from './modules/vivienda/tablero-analitico/TableroAnaliticoPage'
import { ProgramaInformePage } from './modules/vivienda/pages/informe/ProgramaInformePage'
import { GestionesListPage } from './modules/privada/pages/GestionesListPage'
import { TableroPage } from './modules/privada/pages/TableroPage'
import { GasiferaPitPage } from './modules/gasifera/pages/GasiferaPitPage'
import { AtpPage } from './modules/gralgob/pages/AtpPage'
import { ResumenTerritorialPage } from './modules/resumen-territorial/pages/ResumenTerritorialPage'
import { FichaLocalidadPage } from './modules/resumen-territorial/pages/FichaLocalidadPage'
import { TableroGobiernoPage } from './modules/tablero-gobierno/pages/TableroGobiernoPage'
import { NotificacionesPage } from './modules/notificaciones/pages/NotificacionesPage'
import { AdminUsuariosPage } from './modules/admin/pages/AdminUsuariosPage'
import { AdminCatalogosChecklistPage } from './modules/admin/pages/AdminCatalogosChecklistPage'
import { LocalidadesSinResolverPage } from './modules/admin/pages/LocalidadesSinResolverPage'
import { AREA_DE_RUTA } from './shared/utils/permisos'

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
              <Route
                path="resumen-territorial"
                element={
                  <ProtectedRoute
                    roles={['Autoridad']}
                    requiredSecretarias={['supervision']}
                  >
                    <ResumenTerritorialPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resumen-territorial/:departamento/:localidad"
                element={
                  <ProtectedRoute
                    roles={['Autoridad']}
                    requiredSecretarias={['supervision']}
                  >
                    <FichaLocalidadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tablero-gobierno/:seccion?/:sub?"
                element={
                  <ProtectedRoute roles={['Admin', 'Autoridad']}>
                    <TableroGobiernoPage />
                  </ProtectedRoute>
                }
              />
              <Route path="notificaciones" element={<NotificacionesPage />} />
              <Route
                path="vivienda/programas"
                element={<ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/programas']}><ProgramasPage /></ProtectedRoute>}
              />
              <Route path="vivienda/beneficiarios" element={<BeneficiariosListPage />} />
              <Route path="vivienda/beneficiarios/nuevo" element={<BeneficiarioFormPage />} />
              <Route path="vivienda/expedientes" element={<ExpedientesListPage />} />
              <Route
                path="vivienda/cordon-cuneta"
                element={<ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/cordon-cuneta']}><CordonCunetaPage /></ProtectedRoute>}
              />
              <Route
                path="vivienda/cordon-cuneta/informe"
                element={
                  <ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/cordon-cuneta']}>
                    <ProgramaInformePage programa="cordon_cuneta" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="vivienda/cordoba-hogar"
                element={<ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/cordoba-hogar']}><CordobaHogarPage /></ProtectedRoute>}
              />
              <Route
                path="vivienda/cordoba-hogar/informe"
                element={
                  <ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/cordoba-hogar']}>
                    <ProgramaInformePage programa="cordoba_hogar" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="vivienda/mi-lugar"
                element={<ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/mi-lugar']}><MiLugarPage /></ProtectedRoute>}
              />
              <Route
                path="vivienda/checklist-tecnico"
                element={<ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/checklist-tecnico']}><ChecklistTecnicoPage /></ProtectedRoute>}
              />
              <Route
                path="vivienda/tablero-analitico"
                element={<ProtectedRoute requiredArea={AREA_DE_RUTA['/vivienda/tablero-analitico']}><TableroAnaliticoPage /></ProtectedRoute>}
              />
              <Route
                path="privada/gestiones"
                element={
                  <ProtectedRoute requiredSecretarias={['privada']}>
                    <GestionesListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="privada/tablero"
                element={
                  <ProtectedRoute requiredSecretarias={['privada']}>
                    <TableroPage />
                  </ProtectedRoute>
                }
              />
              <Route path="gasifera/pit" element={<GasiferaPitPage />} />
              <Route path="gralgob/atp" element={<AtpPage />} />
              <Route
                path="admin/usuarios"
                element={
                  <ProtectedRoute roles={['Admin']}>
                    <AdminUsuariosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/catalogos-checklist"
                element={
                  <ProtectedRoute roles={['Admin']}>
                    <AdminCatalogosChecklistPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/localidades-sin-resolver"
                element={
                  <ProtectedRoute roles={['Admin']}>
                    <LocalidadesSinResolverPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
