import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export interface Order {
  id: string
  orderNumber: string
  jobName: string
  jobType: string
  quantity: number
  totalValue: number
  paymentType: string
  depositAmount: number
  depositPct: number
  depositReceived: boolean
  balancePaid: boolean
  status: string
  priority: string
  dueDate: string
  notes?: string
  capturedById: string
  customer: { id: string; name: string; phone: string; email: string }
  capturedBy: { id: string; name: string; role: string }
  payments?: any[]
  createdAt: string
}

export function useOrders(filters?: Record<string, string>) {
  return useQuery<Order[]>({
    queryKey: ['orders', filters],
    queryFn: () => api.get('/api/orders', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  })
}

export function useOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['orders', id],
    queryFn: () => api.get(`/api/orders/${id}`).then(r => r.data),
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Order>) => api.post('/api/orders', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order created') },
    onError: () => toast.error('Failed to create order'),
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Order> & { id: string }) =>
      api.put(`/api/orders/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order updated') },
    onError: () => toast.error('Failed to update order'),
  })
}

export function useAdvanceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/orders/${id}/status`, { status }).then(r => r.data),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['orders'] })
      const prev = qc.getQueryData<Order[]>(['orders'])
      qc.setQueryData<Order[]>(['orders'], old => old?.map(o => o.id === id ? { ...o, status } : o) ?? [])
      return { prev }
    },
    onError: (_, __, ctx) => { if (ctx?.prev) qc.setQueryData(['orders'], ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useGenerateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => api.post(`/api/invoices/generate/${orderId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice created') },
    onError: () => toast.error('Failed to create invoice'),
  })
}
