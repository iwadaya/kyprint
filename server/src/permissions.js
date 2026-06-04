// Permission helpers and the server-side financial gate.
// IMPORTANT: financial values are stripped HERE, on the server — never trust the client.

export const ALL_PERMISSIONS = [
  'dashboard.view','orders.create','orders.edit','orders.delete','proofing.manage',
  'stock.manage','deliveries.manage','finance.view','quotes.create','quotes.approve',
  'invoices.create','payments.record','payments.refund','customers.manage',
  'whatsapp.send','users.manage'
];

export const can = (user, key) => !!user && (user.is_owner || user.permissions.includes(key));

export const canSeeFinancials = (user) => can(user, 'finance.view');

// Replace listed monetary fields with null for users without finance.view.
// The client renders null money as an em dash "—".
export function redactMoney(row, fields, user) {
  if (!row) return row;
  if (canSeeFinancials(user)) return row;
  const clone = Array.isArray(row) ? row.map(r => redactMoney(r, fields, user)) : { ...row };
  if (!Array.isArray(row)) for (const f of fields) if (f in clone) clone[f] = null;
  return clone;
}

export const redactList = (rows, fields, user) => rows.map(r => redactMoney(r, fields, user));
