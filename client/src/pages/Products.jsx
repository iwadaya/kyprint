import { useState } from 'react';
import { useFetch } from '../useFetch.js';
import { api } from '../api.js';
import { Metric, Panel, Money, Modal, CapturedBy } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isThisMonth, monthFoot } from '../format.js';

const blankMaterial = () => ({ stock_item_id: '', quantity: '' });

const blank = () => ({
  name: '',
  price: '',
  materials: [blankMaterial()],
});

function toForm(product) {
  if (!product) return blank();
  return {
    id: product.id,
    name: product.name,
    price: product.price ?? '',
    times_ordered: product.times_ordered ?? 0,
    materials: (product.materials || []).length
      ? product.materials.map(m => ({
          stock_item_id: m.stock_item_id,
          quantity: String(m.quantity),
        }))
      : [blankMaterial()],
  };
}

export default function Products() {
  const { can } = useAuth();
  const canManage = can('stock.manage');
  const { data: products, reload } = useFetch('/products');
  const { data: stock } = useFetch('/stock');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const open = (product) => {
    setErrors([]);
    setForm(toForm(product));
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setMaterial = (idx, key, value) => {
    setForm(f => ({
      ...f,
      materials: f.materials.map((m, i) => (i === idx ? { ...m, [key]: value } : m)),
    }));
  };

  const addMaterial = () => setForm(f => ({ ...f, materials: [...f.materials, blankMaterial()] }));
  const removeMaterial = (idx) => setForm(f => ({
    ...f,
    materials: f.materials.length <= 1 ? f.materials : f.materials.filter((_, i) => i !== idx),
  }));

  async function save() {
    setBusy(true);
    setErrors([]);
    const errs = [];
    if (!form.name.trim()) errs.push('Product name is required');
    if (form.price === '' || Number(form.price) < 0)
      errs.push('Price must be zero or greater');
    const materials = form.materials.filter(m => m.stock_item_id || m.quantity);
    if (materials.length === 0) errs.push('Add at least one stock item and quantity');
    const seen = new Set();
    for (const m of materials) {
      if (!m.stock_item_id) errs.push('Select a stock item for each material row');
      if (!m.quantity || Number(m.quantity) <= 0) errs.push('Each quantity must be greater than zero');
      if (m.stock_item_id) {
        if (seen.has(m.stock_item_id)) errs.push('Each stock item can only be used once');
        seen.add(m.stock_item_id);
      }
    }
    if (errs.length) {
      setErrors([...new Set(errs)]);
      setBusy(false);
      return;
    }

    const body = {
      name: form.name.trim(),
      price: Number(form.price),
      materials: materials.map(m => ({
        stock_item_id: m.stock_item_id,
        quantity: Number(m.quantity),
      })),
    };

    try {
      if (form.id) await api(`/products/${form.id}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      setForm(null);
      reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setBusy(false);
    }
  }

  if (!products) return <div className="loading">Loading products…</div>;

  const month = products.filter(p => isThisMonth(p.created_at));
  const isEdit = !!form?.id;
  const usedStockIds = new Set((form?.materials || []).map(m => m.stock_item_id).filter(Boolean));

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Products" strip="var(--cyan)" value={products.length} foot={monthFoot()} />
        <Metric label="Added This Month" strip="var(--green)" value={month.length} foot={monthFoot()} />
        <Metric label="Avg Materials" strip="var(--amber)"
          value={products.length
            ? (products.reduce((s, p) => s + (p.materials?.length || 0), 0) / products.length).toFixed(1)
            : '—'}
          foot={monthFoot()} />
      </div>

      <Panel
        title="Products"
        sub={`${products.length} total`}
        actions={canManage &&
          <button type="button" className="btn btn-primary btn-sm btn-wide" onClick={() => open(null)}>
            + New product
          </button>}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Materials</th>
              <th>Price</th>
              <th>Times ordered</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr
                key={p.id}
                style={{ cursor: canManage ? 'pointer' : 'default' }}
                onClick={() => canManage && open(p)}
              >
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>
                  <div className="t-sub">
                    {(p.materials || []).map(m => (
                      <div key={m.id || m.stock_item_id}>
                        <span className="mono">{m.quantity}</span> × {m.stock_name}
                      </div>
                    ))}
                    {(!p.materials || p.materials.length === 0) && '—'}
                  </div>
                </td>
                <td><Money value={p.price} /></td>
                <td className="mono">{p.times_ordered ?? 0}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  No products yet — add one to get started
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {form && (
        <Modal
          title={isEdit ? 'Edit Product' : 'New Product'}
          sub="Bill of materials"
          wide
          onClose={() => setForm(null)}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
            </button>
          </>}
        >
          <CapturedBy />
          {isEdit && (
            <div className="field">
              <label>Times ordered</label>
              <input className="input mono" value={form.times_ordered ?? 0} readOnly />
            </div>
          )}
          <div className="row-2">
            <div className="field"><label>Product name</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
                     placeholder="e.g. A3 Canvas Print" /></div>
            <div className="field"><label>Price (ZAR)</label>
              <input className="input mono" type="number" min="0" step="0.01" value={form.price}
                     onChange={e => set('price', e.target.value)} placeholder="0.00" /></div>
          </div>

          <div className="section-title" style={{ marginTop: 8 }}>Stock used</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            At least one stock item and quantity is required.
          </p>

          {form.materials.map((m, idx) => (
            <div className="row-2" key={idx} style={{ alignItems: 'end', marginBottom: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}><label>Stock item</label>
                <select className="input" value={m.stock_item_id}
                        onChange={e => setMaterial(idx, 'stock_item_id', e.target.value)}>
                  <option value="">Select stock…</option>
                  {(stock || []).map(s => (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={usedStockIds.has(s.id) && s.id !== m.stock_item_id}
                    >
                      {s.name} ({s.sku})
                    </option>
                  ))}
                </select></div>
              <div className="flex aic gap8">
                <div className="field" style={{ marginBottom: 0, flex: 1 }}><label>Quantity</label>
                  <input className="input mono" type="number" min="0.001" step="any" value={m.quantity}
                         onChange={e => setMaterial(idx, 'quantity', e.target.value)}
                         placeholder="e.g. 1 or 100" /></div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 0 }}
                        onClick={() => removeMaterial(idx)}
                        disabled={form.materials.length <= 1}
                        title="Remove">✕</button>
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-ghost btn-sm" onClick={addMaterial} style={{ marginTop: 4 }}>
            + Add stock line
          </button>

          {errors.length > 0 && <div className="field-error" style={{ marginTop: 12 }}>{errors.join(' · ')}</div>}
        </Modal>
      )}
    </>
  );
}
