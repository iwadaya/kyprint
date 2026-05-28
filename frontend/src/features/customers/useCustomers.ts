import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export interface Customer {
  id: string
  name: string
  contactPerson?: string | null
  email: string
  phone: string
  address?: string | null
  type: 'INDIVIDUAL' | 'BUSINESS' | 'CORPORATE'
  createdAt: string
  _count?: { orders: number }
  orders?: any[]
  invoices?: any[]
}

export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/api/customers').then(r => r.data),
  })
}

export function useCustomer(id: string | null) {
  return useQuery<Customer>({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/api/customers/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Customer>) => api.post('/api/customers', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer added') },
    onError: () => toast.error('Failed to add customer'),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Customer> & { id: string }) =>
      api.put(`/api/customers/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer updated') },
    onError: () => toast.error('Failed to update customer'),
  })
}
