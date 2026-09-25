import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from './auth.js';
import { runMigrations } from './migrate.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import salesRoutes from './routes/sales.js';
import billingRoutes from './routes/billing.js';
import catalogRoutes from './routes/catalog.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import portalRoutes from './routes/portal.js';
import publicRoutes from './routes/public.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public auth + public customer portal (token-authenticated via the URL).
app.use('/api/auth', authRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/public', publicRoutes);

// Everything below requires a valid token.
app.use('/api', authenticate);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api', salesRoutes);       // /orders, /quotes
app.use('/api', billingRoutes);     // /invoices, /payments, /reminders
app.use('/api', catalogRoutes);     // /proofs, /stock, /deliveries, /whatsapp
app.use('/api/users', userRoutes);  // access control

// /api/auth/me needs the user, so re-mount the protected variant
app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }));

// In production the built client is served from this same origin, so the
// client's relative `/api` calls work with no CORS or base-URL config.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html so react-router
  // (including the public /portal/:token route) drives client-side routing.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;

async function start() {
  // Apply migrations/seed on boot so a fresh Render deploy is ready without a
  // separate psql step. Set AUTO_MIGRATE=false to manage the schema yourself.
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      await runMigrations();
    } catch (err) {
      console.error('Database migration failed on boot:', err);
      process.exit(1);
    }
  }
  app.listen(PORT, () => console.log(`PrintShop Pro API on :${PORT}`));
}

start();

export default app;
