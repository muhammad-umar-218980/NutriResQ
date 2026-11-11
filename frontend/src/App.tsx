import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireRole } from './auth/guards'
import { isPortalId } from './config/auth-portals'
import AdminAlgorithmsPage from './pages/admin/AdminAlgorithmsPage'
import AdminBenchmarksPage from './pages/admin/AdminBenchmarksPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverviewPage from './pages/admin/AdminOverviewPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminWorkspacePage from './pages/admin/AdminWorkspacePage'
import AdminLoginPage from './pages/AdminLoginPage'
import AuthPage from './pages/AuthPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import RoleLayout from './pages/workspace/RoleLayout'
import RoleProfilePage from './pages/workspace/RoleProfilePage'
import { RoleOverview } from './pages/workspace/RoleOverview'
import DonorDonationsPage from './pages/workspace/DonorDonationsPage'
import RecipientFoodPage from './pages/workspace/RecipientFoodPage'
import DeliveryVehiclesPage from './pages/workspace/DeliveryVehiclesPage'
import DeliveryAssignmentsPage from './pages/workspace/DeliveryAssignmentsPage'
import type { PortalId } from './types/auth'

const ROLE_TO_PORTAL: Record<string, PortalId> = {
  donor: 'donor',
  recipient: 'recipient',
  fleet: 'delivery',
  delivery: 'delivery',
}

function LoginRedirect() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const next = new URLSearchParams({ mode: 'login' })
  const portal = params.get('portal')

  if (isPortalId(portal)) next.set('portal', portal)

  return <Navigate to={`/auth?${next.toString()}`} replace />
}

function RegisterRedirect() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const next = new URLSearchParams({ mode: 'signup' })

  const portalParam = params.get('portal')
  const roleParam = params.get('role')
  const portal = isPortalId(portalParam)
    ? portalParam
    : roleParam
      ? ROLE_TO_PORTAL[roleParam]
      : undefined

  if (portal) next.set('portal', portal)

  return <Navigate to={`/auth?${next.toString()}`} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/register" element={<RegisterRedirect />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="workspace" element={<AdminWorkspacePage />} />
            <Route path="algorithms" element={<AdminAlgorithmsPage />} />
            <Route path="benchmarks" element={<AdminBenchmarksPage />} />
            <Route path="donors" element={<AdminUsersPage key="donor" role="donor" />} />
            <Route
              path="recipients"
              element={<AdminUsersPage key="recipient" role="recipient" />}
            />
            <Route
              path="delivery-partners"
              element={<AdminUsersPage key="delivery" role="delivery" />}
            />
          </Route>

          <Route
            path="/donor"
            element={
              <RequireRole role="donor">
                <RoleLayout role="donor" />
              </RequireRole>
            }
          >
            <Route index element={<RoleOverview role="donor" />} />
            <Route path="donations" element={<DonorDonationsPage />} />
            <Route path="profile" element={<RoleProfilePage role="donor" />} />
          </Route>

          <Route
            path="/recipient"
            element={
              <RequireRole role="recipient">
                <RoleLayout role="recipient" />
              </RequireRole>
            }
          >
            <Route index element={<RoleOverview role="recipient" />} />
            <Route path="available" element={<RecipientFoodPage />} />
            <Route path="profile" element={<RoleProfilePage role="recipient" />} />
          </Route>

          <Route
            path="/delivery"
            element={
              <RequireRole role="delivery">
                <RoleLayout role="delivery" />
              </RequireRole>
            }
          >
            <Route index element={<RoleOverview role="delivery" />} />
            <Route path="vehicles" element={<DeliveryVehiclesPage />} />
            <Route path="assignments" element={<DeliveryAssignmentsPage />} />
            <Route path="profile" element={<RoleProfilePage role="delivery" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
