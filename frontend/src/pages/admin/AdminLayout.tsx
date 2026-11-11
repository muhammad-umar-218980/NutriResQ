import { Outlet } from 'react-router-dom'
import AppShell from '../../components/app/AppShell'
import type { AppNavItem } from '../../components/app/AppShell'

const ADMIN_NAV: AppNavItem[] = [
  { label: 'Overview', to: '/admin', end: true },
  { label: 'Workspace', to: '/admin/workspace' },
  { label: 'Algorithms', to: '/admin/algorithms' },
  { label: 'Benchmarks', to: '/admin/benchmarks' },
  { label: 'Food Donors', to: '/admin/donors' },
  { label: 'Food Recipients', to: '/admin/recipients' },
  { label: 'Delivery Partners', to: '/admin/delivery-partners' },
]

export default function AdminLayout() {
  return (
    <AppShell workspace="Admin" nav={ADMIN_NAV}>
      <Outlet />
    </AppShell>
  )
}
