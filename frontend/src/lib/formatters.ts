import { format, parseISO } from 'date-fns'

export const fmtCurrency = (n: number | string) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(n))

export const fmtDate = (d: string | Date) =>
  format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy')

export const fmtDateTime = (d: string | Date) =>
  format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy HH:mm')

export const calcVAT = (total: number) => ({
  excl: total / 1.15,
  vat: total - total / 1.15,
  incl: total,
})

export const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

export const orderStatusColour: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-gray-100 text-gray-600',
  OVERDUE: 'bg-red-100 text-red-700',
}

export const invoiceStatusColour: Record<string, string> = {
  UNPAID: 'bg-red-100 text-red-700',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-purple-100 text-purple-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
}
