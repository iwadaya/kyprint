# PrintShop Pro

Full-stack print shop management system.

## Features
- Customer & order management with status tracking
- Flexible payments: full upfront, % deposit, fixed deposit, COD
- Quick invoice generation (deposit / balance / tax invoice)
- File proofing & customer approvals
- WhatsApp Business API automated notifications
- Automated payment reminder scheduler (pre-due + overdue)
- Auto-stop reminders on payment + staff notifications
- Role-based access: Admin, Sales, Press Operator, Driver, Customer
- Captured-by staff tracking on every action
- Customer self-service portal

## Quick start

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis
- Meta WhatsApp Business API credentials

### Backend
```bash
cd backend
npm install
cp .env.example .env        # fill in your values
npx prisma migrate dev      # creates all tables
npx tsx src/prisma/seed.ts  # optional: seed demo data
npm run dev                 # http://localhost:3000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_URL=http://localhost:3000
npm run dev                 # http://localhost:5173
```

## Deployment
- Backend: Railway or Render (Node + PostgreSQL + Redis add-ons)
- Frontend: Vercel or Netlify
- Files: Supabase Storage
- Estimated cost: ~R300–600/month

See /docs for full backend and frontend specifications.
