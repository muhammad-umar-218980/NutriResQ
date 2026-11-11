import { Outlet } from 'react-router-dom'
import AppShell from '../../components/app/AppShell'
import type { AppNavItem } from '../../components/app/AppShell'
import { useAuth } from '../../auth/context'
import { ROLE_LABEL, type PortalId } from '../../types/auth'

const NAV: Record<PortalId, AppNavItem[]> = {
  donor: [
    { label: 'Overview', to: '/donor', end: true },
    { label: 'My Donations', to: '/donor/donations' },
    { label: 'Profile', to: '/donor/profile' },
  ],
  recipient: [
    { label: 'Overview', to: '/recipient', end: true },
    { label: 'Available Food', to: '/recipient/available' },
    { label: 'Profile', to: '/recipient/profile' },
  ],
  delivery: [
    { label: 'Overview', to: '/delivery', end: true },
    { label: 'My Fleet', to: '/delivery/vehicles' },
    { label: 'Assignments', to: '/delivery/assignments' },
    { label: 'Profile', to: '/delivery/profile' },
  ],
}

export default function RoleLayout({ role }: { role: PortalId }) {
  const { user } = useAuth()

  return (
    <AppShell workspace={ROLE_LABEL[role]} nav={NAV[role]}>
      <Outlet context={{ user }} />
    </AppShell>
  )
}
