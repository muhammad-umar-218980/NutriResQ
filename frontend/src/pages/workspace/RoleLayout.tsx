import { Outlet } from 'react-router-dom'
import {
  Apple,
  ClipboardList,
  LayoutDashboard,
  Package,
  Truck,
  UserRound,
} from 'lucide-react'
import AppShell from '../../components/app/AppShell'
import type { AppNavItem } from '../../components/app/AppShell'
import { useAuth } from '../../auth/context'
import { ROLE_LABEL, type PortalId } from '../../types/auth'

const NAV: Record<PortalId, AppNavItem[]> = {
  donor: [
    { label: 'Overview', to: '/donor', end: true, icon: LayoutDashboard },
    { label: 'My Donations', to: '/donor/donations', icon: Package },
    { label: 'Profile', to: '/donor/profile', icon: UserRound },
  ],
  recipient: [
    { label: 'Overview', to: '/recipient', end: true, icon: LayoutDashboard },
    { label: 'Available Food', to: '/recipient/available', icon: Apple },
    { label: 'Profile', to: '/recipient/profile', icon: UserRound },
  ],
  delivery: [
    { label: 'Overview', to: '/delivery', end: true, icon: LayoutDashboard },
    { label: 'My Fleet', to: '/delivery/vehicles', icon: Truck },
    { label: 'Assignments', to: '/delivery/assignments', icon: ClipboardList },
    { label: 'Profile', to: '/delivery/profile', icon: UserRound },
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
