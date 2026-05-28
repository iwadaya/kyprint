import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const ordersRouter = Router()
ordersRouter.use(requireAuth)

// Generate order number e.g. PJ-2026-001
async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.order.count()
  return `PJ-${year}-${String(count + 1).padStart(3, '0')}`
}

ordersRouter.get('/', async (req, res, next) => {
  try {
    const { status, customerId, priority, capturedById } = req.query
    const where: any = {}
    if (status)       where.status = status
    if (customerId)   where.customerId = customerId
    if (priority)     where.priority = priority
    if (capturedById) where.capturedById = capturedById

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        capturedBy: { select: { id: true, name: true, role: true } },
        payments: true,
        _count: { select: { invoices: true, proofs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(orders)
  } catch (err) { next(err) }
})

ordersRouter.post('/', requireRole('ADMIN', 'SALES'), async (req: AuthRequest, res, next) => {
  try {
    const orderNumber = await nextOrderNumber()
    const order = await prisma.order.create({
      data: { ...req.body, orderNumber },
      include: {
        customer: { select: { id: true, name: true } },
        capturedBy: { select: { id: true, name: true } },
      },
    })
    res.status(201).json(order)
  } catch (err) { next(err) }
})

ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        capturedBy: { select: { id: true, name: true, role: true } },
        payments: { include: { recordedBy: { select: { id: true, name: true } } } },
        invoices: true,
        proofs: { include: { comments: { include: { user: { select: { id: true, name: true } } } } } },
        deliveries: true,
      },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) { next(err) }
})

ordersRouter.put('/:id', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: req.body })
    res.json(order)
  } catch (err) { next(err) }
})

ordersRouter.patch('/:id/status', requireRole('ADMIN', 'SALES', 'PRESS_OPERATOR'), async (req, res, next) => {
  try {
    const { status } = req.body
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    })
    res.json(order)
  } catch (err) { next(err) }
})

ordersRouter.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
