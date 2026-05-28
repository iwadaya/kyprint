import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { api } from '@/lib/api'
import { initials } from '@/lib/formatters'

const navItems = [
  { to: '/',           label: 'Dashboard',  roles: ['ADMIN', 'SALES', 'PRESS_OPERATOR', 'DRIVER'] },
  { to: '/orders',     label: 'Orders',     roles: ['ADMIN', 'SALES', 'PRESS_OPERATOR'] },
  { to: '/quotes',     label: 'Quotes',     roles: ['ADMIN', 'SALES'] },
  { to: '/invoices',   label: 'Invoices',   roles: ['ADMIN', 'SALES'] },
  { to: '/payments',   label: 'Payments',   roles: ['ADMIN', 'SALES'] },
  { to: '/proofs',     label: 'Proofing',   roles: ['ADMIN', 'SALES', 'PRESS_OPERATOR'] },
  { to: '/customers',  label: 'Customers',  roles: ['ADMIN', 'SALES'] },
  { to: '/stock',      label: 'Stock',      roles: ['ADMIN', 'PRESS_OPERATOR'] },
  { to: '/deliveries', label: 'Deliveries', roles: ['ADMIN', 'DRIVER'] },
  { to: '/whatsapp',   label: 'WhatsApp',   roles: ['ADMIN', 'SALES'] },
  { to: '/reminders',  label: 'Reminders',  roles: ['ADMIN'], showBadge: true },
]

export default function AppShell() {
  const { user, currentStaffId, setCurrentStaff, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: staff = [] } = useQuery<any[]>({
    queryKey: ['staff'],
    queryFn: () => api.get('/api/auth/staff').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ['reminders', 'upcoming'],
    queryFn: () => api.get('/api/reminders/upcoming').then(r => r.data),
    staleTime: 60_000,
    enabled: user?.role === 'ADMIN',
  })

  // For drivers, show only Deliveries
  const visibleNav = navItems.filter(n => {
    if (!user) return false
    if (user.role === 'DRIVER') return n.to === '/deliveries'
    return n.roles.includes(user.role)
  })

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {mobileOpen && <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setMobileOpen(false)} />}

      <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static top-0 left-0 z-40 h-full w-52 bg-white border-r border-gray-100 flex flex-col transition-transform`}>
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center text-white font-bold text-xs">P</div>
          <span className="font-semibold text-sm tracking-tight">PrintShop Pro</span>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleNav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-2 text-sm rounded-lg mx-2 mb-0.5 transition ${
                  isActive ? 'bg-brand-light text-brand font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{n.label}</span>
              {n.showBadge && upcoming.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{upcoming.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center text-brand text-xs font-semibold">
              {user ? initials(user.name) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user?.name}</div>
              <div className="text-xs text-gray-400">{user?.role.replace('_', ' ')}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="w-full text-xs text-gray-500 hover:text-red-600 text-left py-1"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-5 py-2.5 flex items-center justify-between gap-4">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2" aria-label="Open menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:inline">Active staff:</span>
            <select
              value={currentStaffId || ''}
              onChange={e => setCurrentStaff(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 max-w-[160px]"
            >
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.role.replace('_', ' ')})</option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
