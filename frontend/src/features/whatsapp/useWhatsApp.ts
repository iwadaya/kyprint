import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function useWaLog() {
  return useQuery<any[]>({ queryKey: ['wa', 'log'], queryFn: () => api.get('/api/notifications/log').then(r => r.data) })
}

export function useSendWA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { orderId: string; customerPhone: string; templateName?: string }) =>
      api.post('/api/notifications/whatsapp/send', data).then(r => r.data),
    onSuccess: (_, vars: any) => {
      qc.invalidateQueries({ queryKey: ['wa'] })
      toast.success(`WhatsApp sent (${vars.customerPhone})`)
    },
    onError: () => toast.error('Failed to send WhatsApp'),
  })
}
