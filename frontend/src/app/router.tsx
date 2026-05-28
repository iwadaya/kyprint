import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import LoginPage from '@/features/auth/LoginPage'
import AppShell from '@/components/layout/AppShell'
import DashboardPage from '@/features/dashboard/DashboardPage'
import OrdersPage from '@/features/orders/OrdersPage'
import InvoicesPage from '@/features/invoices/InvoicesPage'
import PaymentTrackerPage from '@/features/payments/PaymentTrackerPage'
import ProofingPage from '@/features/proofs/ProofingPage'
import CustomersPage from '@/features/customers/CustomersPage'
import StockPage from '@/features/stock/StockPage'
import DeliveriesPage from '@/features/deliveries/DeliveriesPage'
import WhatsAppPage from '@/features/whatsapp/WhatsAppPage'
import RemindersPage from '@/features/reminders/RemindersPage'
import QuotesPage from '@/features/quotes/QuotesPage'
import PortalPage from '@/features/portal/PortalPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function StaffRoot({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (user?.role === 'CUSTOMER') return <Navigate to="/portal" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth><StaffRoot><AppShell /></StaffRoot></RequireAuth>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders',     element: <RequireRole roles={['ADMIN','SALES','PRESS_OPERATOR']}><OrdersPage /></RequireRole> },
      { path: 'quotes',     element: <RequireRole roles={['ADMIN','SALES']}><QuotesPage /></RequireRole> },
      { path: 'invoices',   element: <RequireRole roles={['ADMIN','SALES']}><InvoicesPage /></RequireRole> },
      { path: 'payments',   element: <RequireRole roles={['ADMIN','SALES']}><PaymentTrackerPage /></RequireRole> },
      { path: 'proofs',     element: <RequireRole roles={['ADMIN','SALES','PRESS_OPERATOR']}><ProofingPage /></RequireRole> },
      { path: 'customers',  element: <RequireRole roles={['ADMIN','SALES']}><CustomersPage /></RequireRole> },
      { path: 'stock',      element: <RequireRole roles={['ADMIN','PRESS_OPERATOR']}><StockPage /></RequireRole> },
      { path: 'deliveries', element: <RequireRole roles={['ADMIN','DRIVER']}><DeliveriesPage /></RequireRole> },
      { path: 'whatsapp',   element: <RequireRole roles={['ADMIN','SALES']}><WhatsAppPage /></RequireRole> },
      { path: 'reminders',  element: <RequireRole roles={['ADMIN']}><RemindersPage /></RequireRole> },
    ],
  },
  {
    path: '/portal',
    element: <RequireAuth><PortalPage /></RequireAuth>,
  },
])
