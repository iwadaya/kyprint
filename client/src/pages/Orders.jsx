import { useState } from 'react';
import { useFetch } from '../useFetch.js';
import { api } from '../api.js';
import { Metric, Panel, Money, Badge, Modal, CapturedBy } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, isThisMonth, monthFoot, splitDateTimeForForm, combineDateTimeForApi } from '../format.js';

const STATUSES = [
  { value: 'in_production', label: 'In Production' },
  { value: 'proofing', label: 'Proofing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const METRICS = [
  { key: 'in_production', label: 'In Production', strip: 'var(--cyan)', scope: 'all' },
  { key: 'proofing', label: 'Proofing', strip: 'var(--amber)', scope: 'all' },
  { key: 'ready', label: 'Ready / Collect', strip: 'var(--green)', scope: 'all' },
  { key: 'completed', label: 'Completed', strip: 'var(--purple)', scope: 'all' },
  { key: 'all', label: 'Total Orders', strip: 'var(--cyan)', scope: 'month' },
];

const blankItem = () => ({ product_id: '', quantity: '1' });

const blank = () => ({
  customer_id: '',
  customer_name: '',
  status: 'in_production',
  deposit_amount: '',
  due_date: '',
  due_time: '',
  assigned_to_id: '',
  notes: '',
  items: [blankItem()],
});

function toForm(order) {
  if (!order) return blank();
  const due = splitDateTimeForForm(order.due_date);
  return {
    id: order.id,
    order_number: order.order_number,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    description: order.description,
    status: order.status,
    subtotal: order.subtotal ?? '',
    deposit_amount: order.deposit_amount ?? '',
    total: order.total ?? '',
    due_date: due.date,
    due_time: due.time,
    assigned_to_id: order.assigned_to_id || '',
    notes: order.notes || '',
    items: (order.items || []).length
      ? order.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: String(i.quantity),
          unit_price: i.unit_price,
          line_total: i.line_total,
        }))
      : [blankItem()],
  };
}

export default function Orders() {
  const { can } = useAuth();
  const canEdit = can('orders.edit');
  const canCreate = can('orders.create');
  const canDelete = can('orders.delete');
  const canSeeMoney = can('finance.view');
  const { data: orders, reload } = useFetch('/orders');
  const { data: customers } = useFetch('/customers');
  const { data: staff } = useFetch('/orders/staff');
  const { data: products } = useFetch('/products');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const open = (order) => {
    setErrors([]);
    setForm(toForm(order));
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setItem = (idx, key, value) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)),
    }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  const removeItem = (idx) =>
    setForm((f) => ({
      ...f,
      items: f.items.length <= 1 ? f.items : f.items.filter((_, i) => i !== idx),
    }));

  const toggleStatusFilter = (key) => setStatusFilter((f) => (f === key ? null : key));

  async function save() {
    setBusy(true);
    setErrors([]);
    const isEdit = !!form.id;
    const errs = [];

    if (isEdit) {
      // products locked — only status / assignee / due / notes
    } else {
      if (!form.customer_id) errs.push('Customer is required');
      const items = form.items.filter((i) => i.product_id || i.quantity);
      if (!items.length) errs.push('At least one product is required');
      const seen = new Set();
      for (const i of items) {
        if (!i.product_id) errs.push('Select a product for each line');
        if (!i.quantity || Number(i.quantity) <= 0) errs.push('Each product quantity must be greater than zero');
        if (i.product_id) {
          if (seen.has(i.product_id)) errs.push('Each product can only appear once');
          seen.add(i.product_id);
        }
      }
    }

    if (errs.length) {
      setErrors([...new Set(errs)]);
      setBusy(false);
      return;
    }

    try {
      if (isEdit) {
        await api(`/orders/${form.id}`, {
          method: 'PUT',
          body: {
            status: form.status,
            due_date: combineDateTimeForApi(form.due_date, form.due_time),
            assigned_to: form.assigned_to_id || null,
            notes: form.notes?.trim() || null,
          },
        });
      } else {
        await api('/orders', {
          method: 'POST',
          body: {
            customer_id: form.customer_id,
            status: form.status,
            due_date: combineDateTimeForApi(form.due_date, form.due_time),
            assigned_to: form.assigned_to_id || null,
            notes: form.notes?.trim() || null,
            deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : 0,
            items: form.items
              .filter((i) => i.product_id)
              .map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) })),
          },
        });
      }
      setForm(null);
      reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setBusy(false);
    }
  }

  async function removeOrder() {
    if (!form?.id || !canDelete) return;
    if (!window.confirm(`Delete ${form.order_number}? Stock used by this order will be restored.`)) return;
    setBusy(true);
    setErrors([]);
    try {
      await api(`/orders/${form.id}`, { method: 'DELETE' });
      setForm(null);
      reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setBusy(false);
    }
  }

  if (!orders) return <div className="loading">Loading orders…</div>;

  const monthOrders = orders.filter((o) => isThisMonth(o.order_date));
  const countStatus = (key, scope) => {
    if (key === 'all') return monthOrders.length;
    const pool = scope === 'month' ? monthOrders : orders;
    return pool.filter((o) => o.status === key).length;
  };

  const filtered = orders.filter((o) => {
    if (statusFilter && statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (assigneeFilter === 'unassigned' && o.assigned_to_id) return false;
    if (assigneeFilter && assigneeFilter !== 'unassigned' && o.assigned_to_id !== assigneeFilter) return false;
    return true;
  });

  const filterActive = statusFilter || assigneeFilter;
  const isEdit = !!form?.id;
  const productMap = new Map((products || []).map((p) => [p.id, p]));

  let productsTotal = 0;
  if (form && !isEdit) {
    for (const it of form.items) {
      const p = productMap.get(it.product_id);
      if (p && it.quantity) productsTotal += Number(p.price || 0) * Number(it.quantity);
    }
    productsTotal = +productsTotal.toFixed(2);
  } else if (form && isEdit) {
    productsTotal = (form.items || []).reduce((s, i) => s + Number(i.line_total || 0), 0);
  }

  const deposit = Number(form?.deposit_amount) || 0;
  const subtotal = Math.max(0, +(productsTotal - deposit).toFixed(2));
  const vat = +(subtotal * 0.15).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  const usedProductIds = new Set((form?.items || []).map((i) => i.product_id).filter(Boolean));

  return (
    <>
      <div className="grid cols-5" style={{ marginBottom: 16 }}>
        {METRICS.map((m) => (
          <Metric
            key={m.key}
            label={m.label}
            strip={m.strip}
            value={countStatus(m.key, m.scope)}
            foot={m.scope === 'month' ? monthFoot() : 'All time'}
            onClick={() => toggleStatusFilter(m.key)}
            active={statusFilter === m.key}
          />
        ))}
      </div>

      <Panel
        title="All Orders"
        sub={filterActive ? `${filtered.length} shown` : `${orders.length} total`}
        actions={
          <div className="panel-actions">
            <select
              className="input filter-select"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label="Filter by assignee"
            >
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {(staff || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name}
                </option>
              ))}
            </select>
            {canCreate && (
              <button type="button" className="btn btn-primary btn-sm btn-wide" onClick={() => open(null)}>
                + New order
              </button>
            )}
          </div>
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer / Item</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Total</th>
              <th>Deposit</th>
              <th>Due</th>
              <th>Captured by</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                style={{ cursor: canEdit ? 'pointer' : 'default' }}
                onClick={() => canEdit && open(o)}
              >
                <td>
                  <span className="t-id">{o.order_number}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                  <div className="t-sub">{o.description}</div>
                </td>
                <td>
                  <Badge value={o.status} />
                </td>
                <td className="t-sub">{o.assigned_to || '—'}</td>
                <td>
                  <Money value={o.total} />
                </td>
                <td>
                  <Money value={o.deposit_amount} className="amt-purple" />
                </td>
                <td className="mono t-sub">{formatDate(o.due_date)}</td>
                <td className="t-sub">{o.captured_by || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  No orders match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {form && (
        <Modal
          title={isEdit ? 'Edit Order' : 'New Order'}
          sub={isEdit ? form.order_number : 'Production job'}
          wide
          onClose={() => setForm(null)}
          footer={
            <>
              {isEdit && canDelete && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginRight: 'auto', color: 'var(--red)' }}
                  onClick={removeOrder}
                  disabled={busy}
                >
                  Delete order
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add order'}
              </button>
            </>
          }
        >
          <CapturedBy />
          {isEdit ? (
            <div className="row-2">
              <div className="field">
                <label>Order number</label>
                <input className="input mono" value={form.order_number} readOnly />
              </div>
              <div className="field">
                <label>Status</label>
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="field">
              <label>Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.filter((s) => !['delivered', 'cancelled', 'completed'].includes(s.value)).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>Customer</label>
            {isEdit ? (
              <input className="input" value={form.customer_name} readOnly />
            ) : (
              <select className="input" value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}>
                <option value="">Select customer…</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field">
            <label>Assigned to</label>
            <select
              className="input"
              value={form.assigned_to_id}
              onChange={(e) => set('assigned_to_id', e.target.value)}
            >
              <option value="">Unassigned</option>
              {(staff || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} — {u.role_label}
                </option>
              ))}
            </select>
          </div>

          <div className="section-title" style={{ marginTop: 8 }}>
            Products
          </div>
          {!isEdit && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              At least one product is required. Stock will be deducted when the order is created.
            </p>
          )}
          {isEdit && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              Products and quantities are locked after an order is created.
            </p>
          )}

          {isEdit
            ? (form.items || []).map((it, idx) => (
                <div className="captured-row" key={idx} style={{ marginTop: 0, marginBottom: 8 }}>
                  <span className="cap-label">{it.product_name || 'Product'}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    × {it.quantity}
                  </span>
                  {canSeeMoney && (
                    <span className="cap-meta">
                      R {Number(it.line_total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              ))
            : form.items.map((it, idx) => (
                <div className="row-2" key={idx} style={{ alignItems: 'end', marginBottom: 8 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Product</label>
                    <select
                      className="input"
                      value={it.product_id}
                      onChange={(e) => setItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">Select product…</option>
                      {(products || []).map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={usedProductIds.has(p.id) && p.id !== it.product_id}
                        >
                          {p.name}
                          {p.price != null ? ` — R ${Number(p.price).toFixed(2)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex aic gap8">
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>Qty</label>
                      <input
                        className="input mono"
                        type="number"
                        min="0.001"
                        step="any"
                        value={it.quantity}
                        onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeItem(idx)}
                      disabled={form.items.length <= 1}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

          {!isEdit && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: 12 }}>
              + Add product
            </button>
          )}

          {canSeeMoney && (
            <>
              <div className="row-2">
                <div className="field">
                  <label>Products total (ex VAT)</label>
                  <input
                    className="input mono"
                    value={productsTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    readOnly
                  />
                </div>
                <div className="field">
                  <label>Deposit</label>
                  {isEdit ? (
                    <input
                      className="input mono"
                      value={Number(form.deposit_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      readOnly
                    />
                  ) : (
                    <input
                      className="input mono"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.deposit_amount}
                      onChange={(e) => set('deposit_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  )}
                </div>
              </div>
              <div className="row-2">
                <div className="field">
                  <label>Subtotal (products − deposit)</label>
                  <input
                    className="input mono"
                    value={
                      isEdit
                        ? Number(form.subtotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                        : subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                    }
                    readOnly
                  />
                </div>
                <div className="field">
                  <label>Total incl. VAT</label>
                  <input
                    className="input mono"
                    value={
                      isEdit
                        ? Number(form.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                        : total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                    }
                    readOnly
                  />
                </div>
              </div>
              {!isEdit && productsTotal > 0 && (
                <div className="captured-row" style={{ marginTop: 0 }}>
                  <span className="cap-label">VAT 15%</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    R {vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="row-2">
            <div className="field">
              <label>Due date</label>
              <input
                className="input mono"
                type="date"
                value={form.due_date}
                onChange={(e) => {
                  const date = e.target.value;
                  setForm((f) => ({
                    ...f,
                    due_date: date,
                    due_time: date ? f.due_time || '17:00' : '',
                  }));
                }}
              />
            </div>
            <div className="field">
              <label>Due time</label>
              <input
                className="input mono"
                type="time"
                value={form.due_time}
                onChange={(e) => set('due_time', e.target.value)}
                disabled={!form.due_date}
              />
            </div>
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Special instructions, finishing notes…"
            />
          </div>

          {errors.length > 0 && <div className="field-error">{errors.join(' · ')}</div>}
        </Modal>
      )}
    </>
  );
}
