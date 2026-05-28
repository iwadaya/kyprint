import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

export const authRouter = Router()

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    )

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    })
  } catch (err) { next(err) }
})

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, phone: true, active: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) { next(err) }
})

// GET /api/auth/staff  — all active staff for dropdowns
authRouter.get('/staff', requireAuth, async (req, res, next) => {
  try {
    const role = (req.query.role as string | undefined)?.toUpperCase()
    const where: any = { active: true }
    if (role) where.role = role
    else where.role = { not: 'CUSTOMER' }
    const staff = await prisma.user.findMany({
      where,
      select: { id: true, name: true, role: true, phone: true },
      orderBy: { name: 'asc' },
    })
    res.json(staff)
  } catch (err) { next(err) }
})

// POST /api/auth/users  — create user (admin only)
authRouter.post('/users', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })
    const { name, email, password, role, phone } = req.body
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hash, role, phone },
      select: { id: true, name: true, email: true, role: true },
    })
    res.status(201).json(user)
  } catch (err) { next(err) }
})

// PUT /api/auth/users/:id/role
authRouter.put('/users/:id/role', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: { id: true, name: true, role: true },
    })
    res.json(user)
  } catch (err) { next(err) }
})

// PATCH /api/auth/users/:id/toggle  — activate/deactivate
authRouter.patch('/users/:id/toggle', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' })
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { active: !user.active },
      select: { id: true, name: true, active: true },
    })
    res.json(updated)
  } catch (err) { next(err) }
})
