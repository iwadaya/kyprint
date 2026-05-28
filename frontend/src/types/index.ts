export type Role = 'ADMIN' | 'PRESS_OPERATOR' | 'DRIVER' | 'SALES' | 'CUSTOMER'
export type OrderStatus = 'NEW' | 'IN_PRODUCTION' | 'READY' | 'DELIVERED' | 'OVERDUE'
export type PaymentType = 'FULL' | 'DEPOSIT_PCT' | 'DEPOSIT_FIXED' | 'COD'
export type InvoiceStatus = 'UNPAID' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE'
export type ProofStatus = 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED'
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
export type DeliveryStatus = 'SCHEDULED' | 'PENDING' | 'DELIVERED'

export interface User {
  id: string; name: string; email: string; role: Role; phone?: string; active: boolean
}
export interface Customer {
  id: string; name: string; contactPerson?: string; email: string; phone: string; address?: string; type: string
}
export interface StockItem {
  id: string; name: string; category: string; quantity: number; minLevel: number; unit: string
}
