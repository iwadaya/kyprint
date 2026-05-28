import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function useOrderPayments(orderId: string | null) {
  return useQuery<any[]>({
    queryKey: ['payments', orderId],
    queryFn: () => api.get(`/api/payments/order/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/api/payments', data).then(r => r.data),
    onSuccess: (_data, vars: any) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      if (vars.paymentType === 'balance') toast.success('Payment recorded — reminders stopped automatically')
      else toast.success('Payment recorded')
    },
    onError: () => toast.error('Failed to record payment'),
  })
}
