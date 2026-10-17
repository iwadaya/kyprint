import { useState } from 'react';
import { useFetch } from '../useFetch.js';
import { api } from '../api.js';
import { Metric, Panel, Badge, Money, Modal, CapturedBy } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, isThisMonth, monthFoot } from '../format.js';

export function Proofing() {
  const { data: proofs } = useFetch('/proofs');
  if (!proofs) return <div className="loading">Loading proofs…</div>;
  const month = proofs.filter(p => isThisMonth(p.sent_at));
  const by = (s) => month.filter(p => p.status === s).length;

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Awaiting Approval" strip="var(--amber)" value={by('awaiting')} foot={monthFoot()} />
        <Metric label="Approved" strip="var(--green)" value={by('approved')} foot={monthFoot()} />
        <Metric label="Changes Requested" strip="var(--red)" value={by('changes_requested')} foot={monthFoot()} />
      </div>
      {proofs.map(p => (
        <div className="panel" style={{ marginBottom: 12 }} key={p.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
            <div className="proof-thumb" style={{ width: 56, height: 56, flex: '0 0 56px' }}>▣</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.filename}</div>
              <div className="t-sub mono">{p.order_number} · {p.customer_name} · v{p.version}</div>
              <div className="t-sub mono">{formatDate(p.sent_at)}</div>
            </div>
            <Badge value={p.status} />
            <button className="btn btn-ghost btn-sm">Open proof</button>
          </div>
        </div>
      ))}
    </>
  );
}

const blankStock = () => ({
  name: '',
  sku: '',
  on_hand: '',
  reorder_at: '',
  unit_cost: '',
});

function stockToForm(item) {
  if (!item) return blankStock();
  return {
    id: item.id,
    name: item.name,
    sku: item.sku || '',
    on_hand: item.on_hand ?? '',
    reorder_at: item.reorder_at ?? '',
    unit_cost: item.unit_cost ?? '',
  };
}

export function Stock() {
  const { can } = useAuth();
  const canManage = can('stock.manage');
  const { data: stock, reload } = useFetch('/stock');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const open = (item) => {
    setErrors([]);
    setForm(stockToForm(item));
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setErrors([]);
    const errs = [];
    if (!form.name.trim()) errs.push('Item name is required');
    if (form.on_hand === '' || Number(form.on_hand) < 0) errs.push('On hand must be zero or greater');
    if (form.reorder_at === '' || Number(form.reorder_at) < 0) errs.push('Reorder level must be zero or greater');
    if (form.unit_cost !== '' && Number(form.unit_cost) < 0) errs.push('Unit cost must be zero or greater');
    if (errs.length) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    const body = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      on_hand: Number(form.on_hand),
      reorder_at: Number(form.reorder_at),
      unit_cost: form.unit_cost === '' ? 0 : Number(form.unit_cost),
    };
    try {
      if (form.id) await api(`/stock/${form.id}`, { method: 'PUT', body });
      else await api('/stock', { method: 'POST', body });
      setForm(null);
      reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setBusy(false);
    }
  }

  async function removeStock() {
    if (!form?.id) return;
    if (!window.confirm(`Delete ${form.name}? This cannot be undone.`)) return;
    setBusy(true);
    setErrors([]);
    try {
      await api(`/stock/${form.id}`, { method: 'DELETE' });
      setForm(null);
      reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setBusy(false);
    }
  }

  if (!stock) return <div className="loading">Loading stock…</div>;
  const month = stock.filter(s => isThisMonth(s.updated_at));
  const isEdit = !!form?.id;

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Stock Items Updated" strip="var(--cyan)" value={month.length} foot={monthFoot()} />
        <Metric label="Low Stock" strip="var(--amber)" value={stock.filter(s => s.state === 'low').length} foot="All time" />
        <Metric label="Out of Stock" strip="var(--red)" value={stock.filter(s => s.state === 'out').length} foot="All time" />
      </div>
      <Panel
        title="Materials & Consumables"
        sub={`${stock.length} items`}
        actions={canManage && (
          <button type="button" className="btn btn-primary btn-sm btn-wide" onClick={() => open(null)}>
            + Add stock
          </button>
        )}
      >
        <table className="table">
          <thead><tr><th>Item</th><th>SKU</th><th>On Hand</th><th>Reorder At</th><th>Status</th></tr></thead>
          <tbody>
            {stock.map(s => (
              <tr
                key={s.id}
                style={{ cursor: canManage ? 'pointer' : 'default' }}
                onClick={() => canManage && open(s)}
              >
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="mono t-sub">{s.sku || '—'}</td>
                <td className="mono" style={{ fontWeight: 600 }}>{s.on_hand}</td>
                <td className="mono t-sub">{s.reorder_at}</td>
                <td><Badge value={s.state} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {form && (
        <Modal
          title={isEdit ? 'Edit stock' : 'Add stock'}
          sub={isEdit ? (form.sku || form.name) : 'Materials and consumables'}
          onClose={() => setForm(null)}
          footer={
            <>
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginRight: 'auto', color: 'var(--red)' }}
                  onClick={removeStock}
                  disabled={busy}
                >
                  Delete stock
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add stock'}
              </button>
            </>
          }
        >
          <CapturedBy />
          <div className="field">
            <label>Item name</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Gloss 170gsm A1" />
          </div>
          <div className="field">
            <label>SKU</label>
            <input className="input mono" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Optional" />
          </div>
          <div className="row-2">
            <div className="field">
              <label>On hand</label>
              <input className="input mono" type="number" min="0" step="0.001" value={form.on_hand} onChange={(e) => set('on_hand', e.target.value)} />
            </div>
            <div className="field">
              <label>Reorder at</label>
              <input className="input mono" type="number" min="0" step="1" value={form.reorder_at} onChange={(e) => set('reorder_at', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Unit cost (ZAR)</label>
            <input className="input mono" type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} placeholder="0.00" />
          </div>
          {errors.length > 0 && (
            <div className="field-error" style={{ marginTop: 12 }}>{errors.join(' · ')}</div>
          )}
        </Modal>
      )}
    </>
  );
}

export function Deliveries() {
  const { data: rows } = useFetch('/deliveries');
  if (!rows) return <div className="loading">Loading deliveries…</div>;
  const month = rows.filter(d => isThisMonth(d.created_at));

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="In Transit" strip="var(--cyan)" value={month.filter(d => d.status === 'in_transit').length} foot={monthFoot()} />
        <Metric label="Delivered" strip="var(--green)" value={month.filter(d => d.status === 'delivered').length} foot={monthFoot()} />
        <Metric label="Awaiting Dispatch" strip="var(--amber)" value={month.filter(d => d.status === 'awaiting').length} foot={monthFoot()} />
      </div>
      <Panel title="Deliveries & Dispatch">
        <table className="table">
          <thead><tr><th>Ref</th><th>Order</th><th>Customer</th><th>Carrier</th><th>Scheduled</th><th>Tracking</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id}>
                <td><span className="t-id">{d.reference}</span></td>
                <td className="mono t-sub">{d.order_number}</td>
                <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                <td>{d.carrier}</td>
                <td className="mono t-sub">{formatDate(d.scheduled_for)}</td>
                <td className="mono t-sub">{d.tracking_ref || '—'}</td>
                <td><Badge value={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

export function WhatsApp() {
  const { data: rows } = useFetch('/whatsapp');
  if (!rows) return <div className="loading">Loading messages…</div>;
  const month = rows.filter(w => isThisMonth(w.sent_at));

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="Total Sent" strip="var(--cyan)" value={month.length} foot={monthFoot()} />
        <Metric label="Delivered" strip="var(--green)" value={month.filter(w => w.status === 'delivered').length} foot={monthFoot()} />
        <Metric label="Read" strip="var(--cyan)" value={month.filter(w => w.status === 'read').length} foot={monthFoot()} />
        <Metric label="Failed" strip="var(--red)" value={month.filter(w => w.status === 'failed').length} foot={monthFoot()} />
      </div>
      <Panel title="Message Log" sub="recent">
        <div className="panel-body" style={{ padding: 14 }}>
          {rows.map(w => (
            <div className="panel" style={{ marginBottom: 10 }} key={w.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                <span className="avatar-sm" style={{ background: 'linear-gradient(135deg,#52d68a,#2fae6a)', width: 36, height: 36 }}>
                  {w.customer_name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{w.customer_name}</div>
                  <div className="t-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>{w.body}</div>
                  <div className="t-sub mono">{formatDate(w.sent_at)}</div>
                </div>
                <Badge value={w.status} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
