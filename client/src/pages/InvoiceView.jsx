import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { rand } from '../api.js';
import { Badge } from '../components/ui.jsx';
import { formatDate } from '../format.js';

export default function InvoiceView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch(`/api/public/invoices/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, [token]);

  if (err) return <div className="loading">Invoice not found.</div>;
  if (!data) return <div className="loading">Loading invoice…</div>;

  const inv = data.invoice;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div className="portal-top">
          <div className="brand-mark">P</div>
          <div>
            <h1>PrintShop Pro</h1>
            <div className="pt-sub mono">INVOICE</div>
          </div>
          <div className="pt-right">
            <div className="pt-cust">{inv.customer_name}</div>
            <div className="pt-acc mono">{inv.invoice_number}</div>
          </div>
        </div>
        <div className="portal-hero">
          <div className="ph-stat">
            <div className="v">{rand(inv.balance)}</div>
            <div className="l">Amount Due</div>
          </div>
          <div className="ph-stat">
            <div className="v" style={{ fontSize: 18 }}>
              <Badge value={inv.status} />
            </div>
            <div className="l">Status</div>
          </div>
          <div className="ph-stat">
            <div className="v" style={{ fontSize: 18 }}>{formatDate(inv.due_date)}</div>
            <div className="l">Due Date</div>
          </div>
        </div>
      </div>

      <div className="portal-body">
        <div className="panel" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="panel-head">
            <h3>{inv.description || 'Tax invoice'}</h3>
            <span className="sub mono">
              {inv.quote_number ? `${inv.quote_number} → ${inv.invoice_number}` : inv.invoice_number}
            </span>
          </div>
          <div className="panel-body" style={{ padding: '8px 18px 18px' }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              Issued {formatDate(inv.issue_date)} · Please use {inv.invoice_number} as your EFT reference
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((it, i) => (
                  <tr key={i}>
                    <td>{it.description}</td>
                    <td className="mono">{Number(it.quantity)}</td>
                    <td className="mono">{rand(it.unit_price)}</td>
                    <td className="mono money">{rand(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 16, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13 }}>
              <div>Subtotal {rand(inv.subtotal)}</div>
              <div>VAT (15%) {rand(inv.vat_amount)}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>
                Amount due {rand(inv.balance)}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <a className="btn btn-primary btn-sm" href={inv.pdf_url} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="portal-foot">PrintShop Pro · Johannesburg · +27 11 880 2200 · hello@printshoppro.co.za</div>
    </div>
  );
}
