import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export interface Invoice {
  id: string
  invoiceNumber: string
  orderId: string
  customerId: string
  invoiceType: string
  amount: string | number
  amountPaid: string | number
  status: 'UNPAID' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE'
  invoiceDate: string
  dueDate: string
  createdAt: string
  customer?: { id: string; name: string; email?: string; phone?: string; address?: string | null }
  order?: { id?: string; orderNumber: string; jobName: string; totalValue?: number; depositAmount?: number; paymentType?: string }
  capturedBy?: { id: string; name: string }
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/api/invoices').then(r => r.data),
  })
}

export function useInvoice(id: string | null) {
  return useQuery<Invoice>({
    queryKey: ['invoices', id],
    queryFn: () => api.get(`/api/invoices/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.patch(`/api/invoices/${id}/mark-paid`, { amount }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice marked paid') },
    onError: () => toast.error('Failed to mark invoice paid'),
  })
}

export function useEmailInvoice() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/invoices/${id}/send-email`).then(r => r.data),
    onSuccess: () => toast.success('Invoice emailed to customer'),
    onError: () => toast.error('Failed to email invoice'),
  })
}
