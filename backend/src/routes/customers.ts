import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const customersRouter = Router()
customersRouter.use(requireAuth)

customersRouter.get('/', async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(customers)
  } catch (err) { next(err) }
})

customersRouter.post('/', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.create({ data: req.body })
    res.status(201).json(customer)
  } catch (err) { next(err) }
})

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (err) { next(err) }
})

customersRouter.put('/:id', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body })
    res.json(customer)
  } catch (err) { next(err) }
})

customersRouter.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
