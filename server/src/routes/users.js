import { Router } from 'express';
import { query } from '../db.js';
import { requirePermission } from '../auth.js';

const r = Router();

// All permission definitions (for the matrix UI), grouped.
r.get('/permissions', requirePermission('users.manage'), async (_req, res) => {
  const { rows } = await query(
    `SELECT key, label, category, sort_order FROM permissions ORDER BY sort_order`);
  res.json(rows);
});

// Users with their granted permission keys (for the collapsible cards).
r.get('/', requirePermission('users.manage'), async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.surname, u.email, u.role_label, u.is_owner, u.avatar_initials,
            COALESCE(array_agg(up.permission_key) FILTER (WHERE up.granted), '{}') AS permissions
       FROM users u
       LEFT JOIN user_permissions up ON up.user_id = u.id
      GROUP BY u.id ORDER BY u.is_owner DESC, u.first_name`);
  res.json(rows);
});

// Replace a user's permission set (the 16-toggle matrix save).
r.put('/:id/permissions', requirePermission('users.manage'), async (req, res) => {
  const keys = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  const target = await query(`SELECT is_owner FROM users WHERE id=$1`, [req.params.id]);
  if (!target.rows[0]) return res.status(404).json({ error: 'Not found' });
  if (target.rows[0].is_owner) return res.status(400).json({ error: 'Owner permissions are locked' });

  await query(`DELETE FROM user_permissions WHERE user_id=$1`, [req.params.id]);
  for (const k of keys) {
    await query(
      `INSERT INTO user_permissions (user_id, permission_key, granted)
       VALUES ($1,$2,TRUE) ON CONFLICT DO NOTHING`, [req.params.id, k]);
  }
  res.json({ ok: true, count: keys.length });
});

export default r;
