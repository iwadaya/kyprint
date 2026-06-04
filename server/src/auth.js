import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { can } from './permissions.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: '12h' });
}

// Verify email + password against the bcrypt hash stored in Postgres (pgcrypto crypt()).
export async function login(email, password) {
  const { rows } = await query(
    `SELECT id, first_name, surname, email, role_label, is_owner, avatar_initials
       FROM users
      WHERE email = $1 AND active = TRUE
        AND password_hash = crypt($2, password_hash)`,
    [email, password]
  );
  if (!rows[0]) return null;
  const user = rows[0];
  user.permissions = await loadPermissions(user.id);
  return { user, token: signToken(user) };
}

async function loadPermissions(userId) {
  const { rows } = await query(
    `SELECT permission_key FROM user_permissions WHERE user_id = $1 AND granted = TRUE`,
    [userId]
  );
  return rows.map(r => r.permission_key);
}

// Express middleware: decode token, attach req.user with permissions.
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { sub } = jwt.verify(token, SECRET);
    const { rows } = await query(
      `SELECT id, first_name, surname, email, role_label, is_owner, avatar_initials
         FROM users WHERE id = $1 AND active = TRUE`, [sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    req.user.permissions = await loadPermissions(sub);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Guard a route by permission key.
export const requirePermission = (key) => (req, res, next) =>
  can(req.user, key) ? next() : res.status(403).json({ error: `Missing permission: ${key}` });
