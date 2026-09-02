import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../useFetch.js';
import { api } from '../api.js';
import { Metric, Panel, Money, Modal, CapturedBy } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isThisMonth, monthFoot } from '../format.js';

const blank = {
  type: 'company', first_name: '', surname: '', company_name: '',
  email: '', phone: '+27 ', address_line1: '', suburb: '', city: '', postal_code: '', vat_number: ''
};

export default function Customers() {
  const { can } = useAuth();
  const { data: customers, reload } = useFetch('/customers');
  const { data: payments } = useFetch('/payments');
  const [form, setForm] = useState(null);   // null = closed
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const open = (c) => { setErrors([]); setForm(c ? { ...blank, ...c } : { ...blank }); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true); setErrors([]);
    try {
      const path = form.id ? `/customers/${form.id}` : '/customers';
      await api(path, { method: form.id ? 'PUT' : 'POST', body: form });
      setForm(null); reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally { setBusy(false); }
  }

  if (!customers) return <div className="loading">Loading customers…</div>;

  const month = customers.filter(c => isThisMonth(c.created_at));
  const monthPayments = (payments || []).filter(p => isThisMonth(p.paid_at) && p.type === 'payment');
  const spendMonth = monthPayments.some(p => p.amount === null)
    ? null
    : monthPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="New Customers" strip="var(--cyan)" value={month.length} foot={monthFoot()} />
        <Metric label="Companies" strip="var(--green)" value={month.filter(c => c.type === 'company').length} foot={monthFoot()} />
        <Metric label="Individuals" strip="var(--amber)" value={month.filter(c => c.type === 'individual').length} foot={monthFoot()} />
        <Metric label="Spend · Month" strip="var(--purple)" value={<Money value={spendMonth} />} foot={monthFoot()} />
      </div>

      <Panel title="Customer Directory" sub={`${customers.length} total`}
        actions={can('customers.manage') &&
          <button className="btn btn-primary btn-sm" onClick={() => open(null)}>+ New customer</button>}>
        <table className="table">
          <thead><tr><th>Customer</th><th>Type</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th></th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} style={{ cursor: can('customers.manage') ? 'pointer' : 'default' }}
                  onClick={() => can('customers.manage') && open(c)}>
                <td><div className="cust-cell">
                  <span className="avatar-sm" style={{ background: 'linear-gradient(135deg,#00d4aa,#03a585)' }}>
                    {(c.first_name?.[0] || '') + (c.surname?.[0] || '')}</span>
                  <div><div style={{ fontWeight: 600 }}>{c.display_name}</div>
                    {c.type === 'company' && <div className="t-sub">{c.first_name} {c.surname}</div>}</div>
                </div></td>
                <td><span className={`badge ${c.type === 'company' ? 'b-cyan' : 'b-grey'}`}>{c.type}</span></td>
                <td className="mono t-sub">{c.email}</td>
                <td className="mono t-sub">{c.phone}</td>
                <td className="mono">{c.order_count}</td>
                <td><Money value={c.lifetime_spend} /></td>
                <td><Link className="btn btn-ghost btn-sm" to={`/portal/${c.portal_token}`}
                         onClick={e => e.stopPropagation()}>Portal</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {form && (
        <Modal title={form.id ? 'Edit Customer' : 'New Customer'} sub="Directory record" onClose={() => setForm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add customer'}</button>
          </>}>
          <CapturedBy />
          <div className="cust-type-toggle">
            <button className={form.type === 'individual' ? 'on' : ''} onClick={() => set('type', 'individual')}>Individual</button>
            <button className={form.type === 'company' ? 'on' : ''} onClick={() => set('type', 'company')}>Company</button>
          </div>
          <div className="row-2">
            <div className="field"><label>First name</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
            <div className="field"><label>Surname</label>
              <input className="input" value={form.surname} onChange={e => set('surname', e.target.value)} /></div>
          </div>
          {form.type === 'company' && (
            <div className="field"><label>Company name</label>
              <input className="input" value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div>
          )}
          <div className="row-2">
            <div className="field"><label>Email</label>
              <input className="input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div className="field"><label>Phone</label>
              <input className="input mono" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="field"><label>Address</label>
            <input className="input" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" /></div>
          <div className="row-2">
            <div className="field"><label>Suburb</label>
              <input className="input" value={form.suburb} onChange={e => set('suburb', e.target.value)} /></div>
            <div className="field"><label>City</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} /></div>
          </div>
          <div className="row-2">
            <div className="field"><label>Postal code</label>
              <input className="input mono" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} /></div>
            <div className="field"><label>VAT number {form.type === 'individual' && '(optional)'}</label>
              <input className="input mono" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="4xxxxxxxxx" /></div>
          </div>
          {errors.length > 0 && <div className="field-error">{errors.join(' · ')}</div>}
        </Modal>
      )}
    </>
  );
}
