import { Outlet } from 'react-router-dom'
import {
  ChartNoAxesCombined,
  Handshake,
  LayoutDashboard,
  Package,
  PanelsTopLeft,
  Truck,
  Workflow,
} from 'lucide-react'
import AppShell from '../../components/app/AppShell'
import type { AppNavItem } from '../../components/app/AppShell'

const ADMIN_NAV: AppNavItem[] = [
  { label: 'Overview', to: '/admin', end: true, icon: LayoutDashboard },
  { label: 'Workspace', to: '/admin/workspace', icon: PanelsTopLeft },
  { label: 'Algorithms', to: '/admin/algorithms', icon: Workflow },
  {
    label: 'Benchmarks',
    to: '/admin/benchmarks',
    icon: ChartNoAxesCombined,
  },
  { label: 'Food Donors', to: '/admin/donors', icon: Package },
  { label: 'Food Recipients', to: '/admin/recipients', icon: Handshake },
  {
    label: 'Delivery Partners',
    to: '/admin/delivery-partners',
    icon: Truck,
  },
]

export default function AdminLayout() {
  return (
    <AppShell workspace="Admin" nav={ADMIN_NAV}>
      <Outlet />
    </AppShell>
  )
}
