import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const proofsRouter = Router()
proofsRouter.use(requireAuth)

proofsRouter.get('/', async (_req, res, next) => {
  try {
    const proofs = await prisma.proof.findMany({
      include: {
        order: { select: { id: true, orderNumber: true, jobName: true, customer: { select: { id: true, name: true } } } },
        uploadedBy: { select: { id: true, name: true } },
        comments: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(proofs)
  } catch (err) { next(err) }
})

proofsRouter.get('/order/:orderId', async (req, res, next) => {
  try {
    const proofs = await prisma.proof.findMany({
      where: { orderId: req.params.orderId },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        comments: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(proofs)
  } catch (err) { next(err) }
})

proofsRouter.post('/', requireRole('ADMIN', 'PRESS_OPERATOR'), async (req: AuthRequest, res, next) => {
  try {
    const proof = await prisma.proof.create({ data: { ...req.body, uploadedById: req.user!.id } })
    res.status(201).json(proof)
  } catch (err) { next(err) }
})

proofsRouter.patch('/:id/approve', async (_req, res, next) => {
  try {
    const proof = await prisma.proof.update({ where: { id: _req.params.id }, data: { status: 'APPROVED' } })
    res.json(proof)
  } catch (err) { next(err) }
})

proofsRouter.patch('/:id/reject', async (_req, res, next) => {
  try {
    const proof = await prisma.proof.update({ where: { id: _req.params.id }, data: { status: 'REVISION_REQUESTED' } })
    res.json(proof)
  } catch (err) { next(err) }
})

proofsRouter.post('/:id/comment', async (req: AuthRequest, res, next) => {
  try {
    const comment = await prisma.proofComment.create({
      data: { proofId: req.params.id, userId: req.user!.id, comment: req.body.comment },
      include: { user: { select: { id: true, name: true } } },
    })
    res.status(201).json(comment)
  } catch (err) { next(err) }
})
