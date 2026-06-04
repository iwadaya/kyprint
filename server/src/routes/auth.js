import { Router } from 'express';
import { login } from '../auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const result = await login(email, password);
  if (!result) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(result);  // { user, token }
});

export default r;
