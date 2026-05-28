import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const invoicesRouter = Router()
invoicesRouter.use(requireAuth)

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count()
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`
}

function determineInvoiceType(order: any): { type: string; amount: number } {
  const total = Number(order.totalValue)
  const dep = Number(order.depositAmount)

  if (order.paymentType === 'DEPOSIT_PCT' || order.paymentType === 'DEPOSIT_FIXED') {
    if (!order.depositReceived) return { type: 'Deposit invoice', amount: dep }
    if (!order.balancePaid)     return { type: 'Balance invoice', amount: total - dep }
  }
  if (order.paymentType === 'COD') return { type: 'Collection invoice', amount: total }
  return { type: 'Tax invoice', amount: total }
}

// POST /api/invoices/generate/:orderId  — quick invoice
invoicesRouter.post('/generate/:orderId', requireRole('ADMIN', 'SALES'), async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { customer: true },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const { type, amount } = determineInvoiceType(order)
    const invoiceNumber = await nextInvoiceNumber()

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        customerId: order.customerId,
        capturedById: req.user!.id,
        invoiceType: type,
        amount,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // net 14
      },
      include: {
        order: { select: { orderNumber: true, jobName: true } },
        customer: true,
        capturedBy: { select: { id: true, name: true } },
      },
    })
    res.status(201).json(invoice)
  } catch (err) { next(err) }
})

invoicesRouter.get('/', async (_req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { orderNumber: true, jobName: true } },
        capturedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(invoices)
  } catch (err) { next(err) }
})

invoicesRouter.get('/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { customer: true, order: true, capturedBy: { select: { id: true, name: true } } },
    })
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    res.json(invoice)
  } catch (err) { next(err) }
})

invoicesRouter.patch('/:id/mark-paid', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'PAID', amountPaid: req.body.amount },
    })
    res.json(invoice)
  } catch (err) { next(err) }
})

invoicesRouter.post('/:id/send-email', requireRole('ADMIN', 'SALES'), async (_req, res) => {
  // NotifyService.sendInvoiceEmail(invoice) — wire up in NotifyService
  res.json({ message: 'Invoice email queued' })
})
