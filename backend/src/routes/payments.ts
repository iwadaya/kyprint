import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'
import { NotifyService } from '../services/NotifyService'

export const paymentsRouter = Router()
paymentsRouter.use(requireAuth)

paymentsRouter.post('/', requireRole('ADMIN', 'SALES'), async (req: AuthRequest, res, next) => {
  try {
    const { orderId, paymentType, amount, method, notes } = req.body

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { invoices: true },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // Record the payment
    const payment = await prisma.payment.create({
      data: {
        orderId,
        recordedById: req.user!.id,
        paymentType,
        amount,
        method,
        paymentDate: new Date(),
        notes,
      },
    })

    // Update order flags
    const updates: any = {}
    if (paymentType === 'deposit') updates.depositReceived = true
    const dep = Number(order.depositAmount)
    const total = Number(order.totalValue)
    const outstanding = order.depositReceived ? total - dep : total
    if (paymentType === 'balance' || Number(amount) >= outstanding) {
      updates.balancePaid = true
      await prisma.invoice.updateMany({
        where: { orderId, status: { not: 'PAID' } },
        data: { status: 'PAID', amountPaid: total },
      })
    }
    if (Object.keys(updates).length) {
      await prisma.order.update({ where: { id: orderId }, data: updates })
    }

    if (updates.balancePaid) {
      const full = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true, invoices: { take: 1 } } })
      if (full?.customer.phone) {
        await NotifyService.sendWhatsApp(full.customer.phone, 'PAYMENT_RECEIVED', {
          customer_name: full.customer.name,
          order_number: full.orderNumber,
          amount_paid: String(amount),
        })
      }
      const invId = full?.invoices[0]?.id
      if (invId) await NotifyService.notifyStaffOnPayment(invId, `Payment received for order ${full!.orderNumber} (${amount})`)
    }

    res.status(201).json(payment)
  } catch (err) { next(err) }
})

paymentsRouter.get('/order/:orderId', async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { orderId: req.params.orderId },
      include: { recordedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(payments)
  } catch (err) { next(err) }
})
