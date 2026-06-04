import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rand } from '../api.js';
import { Badge } from '../components/ui.jsx';

const STEPS = ['Order', 'Proofing', 'Production', 'Quality', 'Ready', 'Delivered'];

function Track({ step }) {
  return (
    <div className="ot-steps">
      {STEPS.map((s, i) => (
        <div className={`ot-step ${i < step ? 'done' : i === step ? 'active' : ''}`} key={s}>
          <div className="dot">{i < step &&
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#062a23" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}</div>
          <div className="lbl">{s}</div>
        </div>
      ))}
    </div>
  );
}

export default function Portal() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch(`/api/portal/${token}`).then(r => r.ok ? r.json() : Promise.reject()).then(setD).catch(() => setErr(true));
  }, [token]);

  if (err) return <div className="loading">Portal not found.</div>;
  if (!d) return <div className="loading">Loading your portal…</div>;
  const active = d.orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div className="portal-top">
          <div className="brand-mark">P</div>
          <div><h1>PrintShop Pro</h1><div className="pt-sub mono">CUSTOMER PORTAL</div></div>
          <div className="pt-right">
            <div className="pt-cust">{d.customer.display_name}</div>
            <div className="pt-acc mono">{d.customer.first_name} {d.customer.surname}</div>
          </div>
        </div>
        <div className="portal-hero">
          <div className="ph-stat"><div className="v">{active}</div><div className="l">Active Orders</div></div>
          <div className="ph-stat"><div className="v">{rand(d.balance)}</div><div className="l">Balance Due</div></div>
          <div className="ph-stat"><div className="v">{d.lifetime_orders}</div><div className="l">Total Orders</div></div>
        </div>
      </div>

      <div className="portal-body">
        <Link className="back-link" to="/customers">← Back to staff app</Link>
        <div className="portal-grid">
          <div className="panel">
            <div className="panel-head"><h3>Your Orders</h3><span className="sub mono">live progress</span></div>
            {d.orders.map(o => (
              <div className="order-track" key={o.order_number}>
                <div className="ot-top">
                  <span className="t-id mono">{o.order_number}</span>
                  <span className="ot-name">{o.description}</span>
                  <span className="mono t-sub" style={{ marginLeft: 'auto' }}>due {o.due_date || '—'}</span>
                </div>
                <Track step={o.step} />
              </div>
            ))}
            {d.orders.length === 0 && <div className="panel-body muted">No orders yet.</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="panel">
              <div className="panel-head"><h3>Proof Approvals</h3></div>
              <div className="panel-body" style={{ padding: '6px 18px 14px' }}>
                {d.proofs.map((p, i) => (
                  <div className="proof-row" key={i}>
                    <div className="proof-thumb">▣</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.filename}</div>
                      <div className="t-sub mono">{p.order_number}</div>
                    </div>
                    <Badge value={p.status} />
                  </div>
                ))}
                {d.proofs.length === 0 && <div className="muted">No proofs to review.</div>}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h3>Invoice History</h3></div>
              <table className="table">
                <thead><tr><th>Invoice</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>
                  {d.invoices.map(v => (
                    <tr key={v.invoice_number}>
                      <td><span className="t-id">{v.invoice_number}</span></td>
                      <td className="mono t-sub">{v.issue_date}</td>
                      <td><Badge value={v.status} /></td>
                      <td className="money mono">{rand(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div className="portal-foot">PrintShop Pro · Johannesburg · +27 11 880 2200 · hello@printshoppro.co.za</div>
    </div>
  );
}
