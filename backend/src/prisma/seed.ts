import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@printshoppro.co.za' },
    update: {},
    create: {
      name: 'Thandi Mokoena',
      email: 'admin@printshoppro.co.za',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      phone: '+27110000001',
    },
  })

  await prisma.user.upsert({
    where: { email: 'sales@printshoppro.co.za' },
    update: {},
    create: {
      name: 'Aimee Joubert',
      email: 'sales@printshoppro.co.za',
      password: await bcrypt.hash('sales123', 10),
      role: 'SALES',
      phone: '+27110000002',
    },
  })

  await prisma.user.upsert({
    where: { email: 'press@printshoppro.co.za' },
    update: {},
    create: {
      name: 'Jabu Dlamini',
      email: 'press@printshoppro.co.za',
      password: await bcrypt.hash('press123', 10),
      role: 'PRESS_OPERATOR',
    },
  })

  await prisma.user.upsert({
    where: { email: 'driver@printshoppro.co.za' },
    update: {},
    create: {
      name: 'Sipho Mthembu',
      email: 'driver@printshoppro.co.za',
      password: await bcrypt.hash('driver123', 10),
      role: 'DRIVER',
    },
  })

  // Demo customers
  const acme = await prisma.customer.create({
    data: {
      name: 'Acme Corp',
      contactPerson: 'Sarah Nkosi',
      email: 'sarah@acme.co.za',
      phone: '+27112223344',
      address: '10 Sandton Drive, Johannesburg',
      type: 'CORPORATE',
    },
  })

  // Reminder schedule steps
  const steps = [
    { daysOffset: -5, label: '5 days before due',    triggerType: 'pre',   channels: ['wa', 'email'] },
    { daysOffset: -3, label: '3 days before due',    triggerType: 'pre',   channels: ['wa', 'email'] },
    { daysOffset: -1, label: '1 day before due',     triggerType: 'pre',   channels: ['wa'] },
    { daysOffset:  0, label: 'On due date',          triggerType: 'due',   channels: ['wa', 'email'] },
    { daysOffset:  3, label: '3 days overdue',       triggerType: 'post',  channels: ['wa', 'email'] },
    { daysOffset:  7, label: '7 days overdue',       triggerType: 'post',  channels: ['wa', 'email'] },
    { daysOffset: 14, label: '14 days overdue',      triggerType: 'post',  channels: ['email'] },
    { daysOffset: 30, label: '30 days — final notice', triggerType: 'final', channels: ['wa', 'email'] },
  ]

  for (const step of steps) {
    await prisma.reminderSchedule.create({ data: step })
  }

  // Demo stock items
  const stockItems = [
    { name: 'Gloss coated A4', category: 'Paper',    quantity: 420, minLevel: 100, unit: 'Reams' },
    { name: 'Matte coated A4', category: 'Paper',    quantity: 80,  minLevel: 100, unit: 'Reams' },
    { name: 'Vinyl roll 1.5m', category: 'Vinyl',    quantity: 12,  minLevel: 5,   unit: 'Rolls' },
    { name: 'CMYK ink set',    category: 'Ink',      quantity: 3,   minLevel: 4,   unit: 'Boxes' },
    { name: 'Gloss laminate',  category: 'Laminate', quantity: 6,   minLevel: 3,   unit: 'Rolls' },
    { name: 'Uncoated bond A4',category: 'Paper',    quantity: 0,   minLevel: 50,  unit: 'Reams' },
  ]

  for (const item of stockItems) {
    await prisma.stockItem.create({ data: item })
  }

  console.log('Seed complete. Default login: admin@printshoppro.co.za / admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
