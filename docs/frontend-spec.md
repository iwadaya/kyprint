# PrintShop Pro — Frontend Specification

## Tech stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Component reuse, type safety across all forms |
| Build tool | Vite | Fast dev server, optimised production builds |
| Routing | React Router v6 | Nested routes, role-based guards |
| State management | Zustand | Lightweight global state (auth, staff, orders) |
| Server state | TanStack Query (React Query) | API caching, background refetch, optimistic updates |
| Forms | React Hook Form + Zod | Validation with schema inference from backend types |
| Styling | Tailwind CSS | Utility-first, consistent spacing + dark mode |
| UI components | shadcn/ui | Accessible, unstyled base — customised to brand |
| PDF preview | react-pdf | Render invoice PDFs inline before download |
| File upload | react-dropzone | Proof file uploads with progress |
| Charts | Recharts | Revenue, payment, and stock dashboards |
| Date handling | date-fns | Due dates, reminder scheduling, ZA locale |
| WhatsApp | Custom hook → API | Calls backend NotifyService |
| Notifications | Sonner (toast) | Success/error/payment alerts |
| Icons | Lucide React | Consistent icon set |
| Testing | Vitest + React Testing Library | Unit + integration tests |
| Deployment | Vercel or Netlify | CI/CD from GitHub, free SSL |

---

## Project structure

```
printshop-web/
├── src/
│   ├── app/
│   │   ├── router.tsx           ← all routes + role guards
│   │   └── providers.tsx        ← QueryClient, AuthProvider, ThemeProvider
│   ├── features/                ← one folder per domain
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── useAuth.ts
│   │   │   └── authStore.ts     ← Zustand: current user + role
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── orders/
│   │   │   ├── OrdersPage.tsx
│   │   │   ├── OrderForm.tsx    ← new + edit
│   │   │   ├── OrderRow.tsx
│   │   │   ├── PaymentSection.tsx
│   │   │   ├── QuickInvoiceButton.tsx
│   │   │   └── useOrders.ts     ← React Query hooks
│   │   ├── quotes/
│   │   ├── invoices/
│   │   │   ├── InvoicesPage.tsx
│   │   │   ├── InvoicePreview.tsx
│   │   │   └── PDFDownloadButton.tsx
│   │   ├── payments/
│   │   │   ├── PaymentTracker.tsx
│   │   │   └── RecordPaymentModal.tsx
│   │   ├── proofs/
│   │   │   ├── ProofingPage.tsx
│   │   │   ├── ProofUploadZone.tsx
│   │   │   └── ProofApprovalCard.tsx
│   │   ├── customers/
│   │   ├── stock/
│   │   ├── deliveries/
│   │   ├── whatsapp/
│   │   │   ├── WAPanel.tsx
│   │   │   └── useWhatsApp.ts
│   │   ├── reminders/
│   │   │   ├── ReminderSchedulePage.tsx
│   │   │   ├── ReminderStepConfig.tsx
│   │   │   └── useReminders.ts
│   │   └── portal/              ← customer-facing portal
│   │       ├── PortalPage.tsx
│   │       └── PortalOrderCard.tsx
│   ├── components/              ← shared UI components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx     ← sidebar + topbar
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── ui/                  ← shadcn primitives
│   │   ├── CapturedBySelect.tsx ← reused on every form
│   │   ├── StatusBadge.tsx
│   │   ├── PaymentBar.tsx       ← deposit/balance progress bar
│   │   ├── DataTable.tsx        ← reusable sortable table
│   │   ├── ConfirmDialog.tsx
│   │   └── RoleBanner.tsx
│   ├── hooks/
│   │   ├── useCurrentStaff.ts
│   │   ├── useRoleGuard.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   ├── api.ts               ← axios instance + interceptors
│   │   ├── formatters.ts        ← ZAR currency, dates, order IDs
│   │   └── constants.ts
│   ├── types/
│   │   └── index.ts             ← shared TypeScript types
│   └── main.tsx
├── public/
├── .env
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## Routing & role guards

```tsx
// router.tsx
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders',    element: <RequireRole roles={['ADMIN','SALES','PRESS']}><OrdersPage /></RequireRole> },
      { path: 'orders/new',element: <RequireRole roles={['ADMIN','SALES']}><OrderForm /></RequireRole> },
      { path: 'orders/:id',element: <OrderDetailPage /> },
      { path: 'quotes',    element: <RequireRole roles={['ADMIN','SALES']}><QuotesPage /></RequireRole> },
      { path: 'invoices',  element: <RequireRole roles={['ADMIN','SALES']}><InvoicesPage /></RequireRole> },
      { path: 'payments',  element: <RequireRole roles={['ADMIN','SALES']}><PaymentTracker /></RequireRole> },
      { path: 'proofs',    element: <RequireRole roles={['ADMIN','SALES','PRESS']}><ProofingPage /></RequireRole> },
      { path: 'customers', element: <RequireRole roles={['ADMIN','SALES']}><CustomersPage /></RequireRole> },
      { path: 'stock',     element: <RequireRole roles={['ADMIN','PRESS']}><StockPage /></RequireRole> },
      { path: 'deliveries',element: <RequireRole roles={['ADMIN','DRIVER']}><DeliveriesPage /></RequireRole> },
      { path: 'whatsapp',  element: <RequireRole roles={['ADMIN','SALES']}><WAPanel /></RequireRole> },
      { path: 'reminders', element: <RequireRole roles={['ADMIN']}><ReminderSchedulePage /></RequireRole> },
      { path: 'settings',  element: <RequireRole roles={['ADMIN']}><SettingsPage /></RequireRole> },
    ],
  },
  {
    path: '/portal',
    element: <RequireAuth role="CUSTOMER"><PortalPage /></RequireAuth>,
  },
]);
```

---

## Auth & global state

```tsx
// authStore.ts (Zustand)
interface AuthState {
  user: User | null
  token: string | null
  setUser: (user: User, token: string) => void
  logout: () => void
}

// On login, store JWT in memory (not localStorage for XSS safety)
// Use httpOnly cookie via API if security is a priority

// useRoleGuard.ts
export function useRoleGuard(allowed: Role[]) {
  const { user } = useAuthStore()
  return allowed.includes(user?.role)
}
```

---

## Shared component: `CapturedBySelect`

Used on every form — orders, quotes, invoices, proofs, payments.

```tsx
// components/CapturedBySelect.tsx
interface Props {
  value: string
  onChange: (staffId: string) => void
}

export function CapturedBySelect({ value, onChange }: Props) {
  const { user } = useAuthStore()
  const { data: staff } = useQuery({ queryKey: ['staff'], queryFn: fetchActiveStaff })

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg mb-3">
      <UserCircle className="w-4 h-4 text-muted-foreground" />
      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Captured by
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {staff?.map(s => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex items-center gap-2">
                <Avatar initials={initials(s.name)} role={s.role} />
                {s.name} ({s.role})
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

---

## Order form — payment section

```tsx
// features/orders/PaymentSection.tsx
export function PaymentSection({ control, watch }: { control: Control, watch: UseFormWatch }) {
  const totalValue = watch('totalValue') || 0
  const paymentType = watch('paymentType')

  const depositAmount = useMemo(() => {
    if (paymentType === 'DEPOSIT_PCT') return totalValue * (watch('depositPct') / 100)
    if (paymentType === 'DEPOSIT_FIXED') return watch('depositFixed') || 0
    return 0
  }, [totalValue, paymentType, watch])

  const balance = totalValue - depositAmount
  const vat = totalValue * 0.15 / 1.15
  const excl = totalValue - vat

  return (
    <div className="border rounded-lg p-3 bg-muted/40 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <FormField name="totalValue" label="Total value (R)" type="number" />
        <FormField name="paymentType" label="Payment arrangement" as="select">
          <option value="FULL">Full payment upfront</option>
          <option value="DEPOSIT_PCT">Deposit (% of total)</option>
          <option value="DEPOSIT_FIXED">Deposit (fixed amount)</option>
          <option value="COD">Full payment on collection</option>
        </FormField>
      </div>

      {(paymentType === 'DEPOSIT_PCT' || paymentType === 'DEPOSIT_FIXED') && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {paymentType === 'DEPOSIT_PCT' && (
              <FormField name="depositPct" label="Deposit %" type="number" min={1} max={99} />
            )}
            {paymentType === 'DEPOSIT_FIXED' && (
              <FormField name="depositFixed" label="Deposit amount (R)" type="number" />
            )}
            <FormField name="depositReceived" label="Deposit received" as="select">
              <option value="true">Yes — paid now</option>
              <option value="false">No — pending</option>
            </FormField>
          </div>
          <PaymentBar deposit={depositAmount} balance={balance} total={totalValue} />
        </>
      )}

      <PaymentSummary excl={excl} vat={vat} deposit={depositAmount} balance={balance} paymentType={paymentType} />
    </div>
  )
}
```

---

## Quick invoice button

```tsx
// features/orders/QuickInvoiceButton.tsx
export function QuickInvoiceButton({ order }: { order: Order }) {
  const [open, setOpen] = useState(false)
  const generateInvoice = useGenerateInvoice()

  const invoiceType = useMemo(() => {
    if (order.paymentType === 'DEPOSIT_PCT' || order.paymentType === 'DEPOSIT_FIXED') {
      if (!order.depositReceived) return 'Deposit invoice'
      if (!order.balancePaid) return 'Balance invoice'
    }
    return 'Tax invoice'
  }, [order])

  const handleGenerate = async () => {
    const invoice = await generateInvoice.mutateAsync(order.id)
    setOpen(true)
    // opens InvoicePreview modal with the generated invoice
  }

  return (
    <>
      <Button variant="outline" size="xs" onClick={handleGenerate} className="text-purple-700 border-purple-300 bg-purple-50 hover:bg-purple-600 hover:text-white">
        <Receipt className="w-3 h-3" /> Invoice
      </Button>
      <InvoicePreviewModal open={open} onClose={() => setOpen(false)} invoiceType={invoiceType} orderId={order.id} />
    </>
  )
}
```

---

## React Query hooks pattern

```tsx
// features/orders/useOrders.ts
export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => api.get('/orders', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateOrderInput) => api.post('/orders', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Order created')
    },
    onError: () => toast.error('Failed to create order'),
  })
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/orders/${id}/status`, { status }).then(r => r.data),
    onMutate: async ({ id, status }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      const prev = queryClient.getQueryData(['orders'])
      queryClient.setQueryData(['orders'], (old: Order[]) =>
        old.map(o => o.id === id ? { ...o, status } : o)
      )
      return { prev }
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['orders'], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}
```

---

## Pages & components by feature

### Dashboard
- Summary metrics: active orders, deposits collected, balance outstanding, overdue count
- Recent orders table (last 10)
- Today's deliveries timeline
- Low stock alerts
- Upcoming reminders (next 3 days)
- Revenue summary (this month)

### Orders page
- Filterable table: status, customer, date range, priority, captured-by staff
- Columns: ID · Job name · Customer · Value · Payment bar · Status · Due · Captured by · WhatsApp · Actions
- Inline status advance button (one click: New → In Production → Ready → Delivered)
- Quick Invoice button per row
- Record Payment button when balance outstanding

### Order form (new + edit)
- `CapturedBySelect` at top, pre-filled from global staff selector
- Customer dropdown (searchable)
- Job details: name, type, quantity, due date, priority
- `PaymentSection` component with live deposit/balance/VAT summary
- Notes textarea
- Two submit buttons: "Save order" and "Save & create invoice"

### Invoices page
- Table: Invoice # · Order · Customer · Type · Amount · Balance · Status · Captured by · Actions
- Invoice type badges: Deposit / Balance / Tax / Full
- PDF preview modal (react-pdf renders inline)
- Email to customer button
- Mark as paid button

### Payment tracker
- Per-order cards with deposit/balance progress bar
- Full payment history per order (type, amount, method, date, recorded by)
- Record payment modal: type, method, amount, recorded-by staff
- Summary metrics: total deposits collected, outstanding balances, fully paid count

### Proofing page
- Upload zone (react-dropzone, PDF/AI/PSD/PNG, 50MB max)
- Order + version selector in upload form
- Proof cards: file info, status badge, comment thread, approve/reject buttons
- Staff can add comments; customers see a simplified view in the portal

### WhatsApp panel
- Pending notifications list (ready orders not yet messaged)
- Send now per order or bulk send all pending
- Message log with delivery status
- Template preview (ORDER_READY etc.)

### Reminder schedule page
- 8-step timeline showing days offset, channels, active toggle
- Upcoming reminders list (next 7 days across all invoices)
- Per-invoice reminder status: which steps fired, which is next
- Activity log: every WA sent, email sent, auto-stop, staff notification
- Settings: channel toggles, auto-stop rules, staff notification list, escalation config

### Customer portal (`/portal`)
- Separate layout — no sidebar, branded header
- Order progress cards with status + percentage bar
- Awaiting approval: proof cards with approve/reject buttons
- Invoice history: amounts, due dates, payment status
- No access to staff, pricing config, or other customers' data

---

## Form validation schema (Zod example)

```tsx
// types/orderSchema.ts
export const orderSchema = z.object({
  customerId:      z.string().uuid('Select a customer'),
  capturedById:    z.string().uuid('Select staff member'),
  jobName:         z.string().min(2, 'Job name required'),
  jobType:         z.string().min(1, 'Select job type'),
  quantity:        z.number().int().positive('Quantity must be positive'),
  totalValue:      z.number().positive('Enter order value'),
  paymentType:     z.enum(['FULL','DEPOSIT_PCT','DEPOSIT_FIXED','COD']),
  depositPct:      z.number().min(1).max(99).optional(),
  depositFixed:    z.number().positive().optional(),
  depositReceived: z.boolean().default(false),
  dueDate:         z.string().min(1, 'Due date required'),
  priority:        z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'),
  notes:           z.string().optional(),
}).refine(data => {
  if (data.paymentType === 'DEPOSIT_PCT' && !data.depositPct) return false
  if (data.paymentType === 'DEPOSIT_FIXED' && !data.depositFixed) return false
  return true
}, { message: 'Enter deposit amount or percentage' })

export type OrderFormValues = z.infer<typeof orderSchema>
```

---

## API client setup

```tsx
// lib/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
})

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally (token expired → redirect to login)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
```

---

## Currency and date formatting (ZA locale)

```tsx
// lib/formatters.ts
export const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n)
// → R 3 200,00

export const fmtDate = (d: string) =>
  format(parseISO(d), 'd MMM yyyy', { locale: enZA })
// → 27 May 2026

export const fmtOrderId = (id: string) => id.toUpperCase()
// → PJ-001

export const orderVAT = (total: number) => ({
  excl: total / 1.15,
  vat:  total - total / 1.15,
  incl: total,
})
```

---

## Environment variables (`.env`)

```env
VITE_API_URL=https://api.printshoppro.co.za
VITE_APP_NAME=PrintShop Pro
VITE_SUPPORT_EMAIL=support@printshoppro.co.za
VITE_WA_PHONE=+27110000000
```

---

## Suggested build order (frontend)

1. Vite + React + TypeScript scaffold
2. Tailwind + shadcn/ui setup, global theme tokens (brand blue, ZAR formatting)
3. Auth: login page, JWT store, `RequireAuth` + `RequireRole` guards
4. `AppShell` — sidebar, topbar, global staff selector, role banner
5. `CapturedBySelect` shared component (used everywhere)
6. Dashboard page (static metrics, connects to API last)
7. Customers CRUD
8. Orders page + `OrderForm` with `PaymentSection`
9. `QuickInvoiceButton` + `InvoicePreview` modal + PDF download
10. `RecordPaymentModal` + `PaymentTracker` page
11. Proofs upload + approval cards
12. WhatsApp panel
13. Reminder schedule page + activity log
14. Customer portal (`/portal` route, separate layout)
15. Connect all pages to live API, end-to-end test each flow
