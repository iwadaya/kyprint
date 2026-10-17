import { Router } from 'express';
import { login } from '../auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await login(email, password);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(result);  // { user, token }
  } catch (err) {
    console.error('Login failed:', err);
    const unreachable = err?.code === 'ETIMEDOUT' || err?.code === 'ENETUNREACH' || err?.code === 'ECONNREFUSED';
    res.status(503).json({
      error: unreachable
        ? 'Database is unreachable. Check your connection and try again.'
        : 'Login failed',
    });
  }
});

export default r;
