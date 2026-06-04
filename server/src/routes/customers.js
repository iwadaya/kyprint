import { Router } from 'express';
import { query } from '../db.js';
import { requirePermission } from '../auth.js';
import { redactList, redactMoney } from '../permissions.js';

const r = Router();

// Validate the refined customer spec before hitting the DB constraints.
function validate(body) {
  const errors = [];
  const type = body.type === 'company' ? 'company' : 'individual';
  if (!body.first_name?.trim()) errors.push('First name is required');
  if (!body.surname?.trim()) errors.push('Surname is required');
  if (type === 'company' && !body.company_name?.trim())
    errors.push('Company name is required for company customers');
  if (!body.email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))
    errors.push('A valid email is required');
  if (!body.phone?.trim()) errors.push('Phone number is required');
  if (body.vat_number && !/^4\d{9}$/.test(body.vat_number))
    errors.push('VAT number must be 10 digits starting with 4');
  return { type, errors };
}

// List (with order count + lifetime spend; spend gated).
r.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, type, display_name, first_name, surname, company_name, email, phone,
            city, vat_number, order_count, lifetime_spend, portal_token
       FROM customer_summary ORDER BY display_name`
  );
  res.json(redactList(rows, ['lifetime_spend'], req.user));
});

r.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT cs.*, customer_display_name(c) AS display_name
       FROM customer_summary cs JOIN customers c ON c.id = cs.id
      WHERE cs.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(redactMoney(rows[0], ['lifetime_spend'], req.user));
});

r.post('/', requirePermission('customers.manage'), async (req, res) => {
  const { type, errors } = validate(req.body);
  if (errors.length) return res.status(422).json({ errors });
  const b = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO customers (type, first_name, surname, company_name, email, phone,
                              address_line1, suburb, city, postal_code, vat_number, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [type, b.first_name, b.surname, type === 'company' ? b.company_name : null,
       b.email, b.phone, b.address_line1 || null, b.suburb || null, b.city || null,
       b.postal_code || null, b.vat_number || null, req.user.id]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    res.status(400).json({ error: e.detail || e.message });
  }
});

r.put('/:id', requirePermission('customers.manage'), async (req, res) => {
  const { type, errors } = validate(req.body);
  if (errors.length) return res.status(422).json({ errors });
  const b = req.body;
  const { rowCount } = await query(
    `UPDATE customers SET type=$1, first_name=$2, surname=$3, company_name=$4, email=$5,
            phone=$6, address_line1=$7, suburb=$8, city=$9, postal_code=$10, vat_number=$11
      WHERE id=$12`,
    [type, b.first_name, b.surname, type === 'company' ? b.company_name : null,
     b.email, b.phone, b.address_line1 || null, b.suburb || null, b.city || null,
     b.postal_code || null, b.vat_number || null, req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default r;
