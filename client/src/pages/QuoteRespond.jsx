import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { rand } from '../api.js';
import { Badge } from '../components/ui.jsx';
import { formatDate } from '../format.js';

export default function QuoteRespond() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [invoiceInfo, setInvoiceInfo] = useState(null);

  const load = () => {
    setErr(null);
    fetch(`/api/public/quotes/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d);
        if (d.invoice) setInvoiceInfo(d.invoice);
      })
      .catch(() => setErr(true));
  };

  useEffect(load, [token]);

  async function respond(decision) {
    setBusy(decision);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/quotes/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body.errors?.join(' · ') || body.error || 'Could not update quote');
        return;
      }

      if (body.status === 'accepted') {
        if (body.invoice) setInvoiceInfo(body.invoice);
        setMessage(
          body.already
            ? 'You already accepted this quote. Thank you!'
            : 'Quote accepted. Your invoice has been created and sent to you by email and WhatsApp for payment.'
        );
      } else {
        setMessage(
          body.already
            ? 'You already declined this quote.'
            : 'Quote declined. Thank you for letting us know.'
        );
      }
      load();
    } catch {
      setMessage('Could not update quote. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  if (err) return <div className="loading">Quote not found.</div>;
  if (!data) return <div className="loading">Loading quote…</div>;

  const q = data.quote;
  const canRespond = data.can_respond;
  const inv = invoiceInfo || data.invoice;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div className="portal-top">
          <div className="brand-mark">P</div>
          <div>
            <h1>PrintShop Pro</h1>
            <div className="pt-sub mono">QUOTE RESPONSE</div>
          </div>
          <div className="pt-right">
            <div className="pt-cust">{q.customer_name}</div>
            <div className="pt-acc mono">{q.quote_number}</div>
          </div>
        </div>
        <div className="portal-hero">
          <div className="ph-stat">
            <div className="v">{rand(q.total)}</div>
            <div className="l">Quote Total</div>
          </div>
          <div className="ph-stat">
            <div className="v" style={{ fontSize: 18 }}>
              <Badge value={q.status} />
            </div>
            <div className="l">Status</div>
          </div>
          <div className="ph-stat">
            <div className="v" style={{ fontSize: 18 }}>{formatDate(q.valid_until)}</div>
            <div className="l">Valid Until</div>
          </div>
        </div>
      </div>

      <div className="portal-body">
        <div className="panel" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="panel-head">
            <h3>{q.description}</h3>
            <span className="sub mono">{q.quote_number}</span>
          </div>
          <div className="panel-body" style={{ padding: '8px 18px 18px' }}>
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
              <div>Subtotal {rand(q.subtotal)}</div>
              <div>VAT (15%) {rand(q.vat_amount)}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>Total {rand(q.total)}</div>
            </div>

            <div style={{ marginTop: 18 }}>
              <a className="btn btn-ghost btn-sm" href={q.pdf_url} target="_blank" rel="noreferrer">
                View quote PDF
              </a>
            </div>

            {message && (
              <div
                className="field-error"
                style={{
                  marginTop: 16,
                  color: q.status === 'declined' ? 'var(--red)' : 'var(--green)',
                }}
              >
                {message}
              </div>
            )}

            {inv && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--panel-2, transparent)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Invoice {inv.invoice_number} · {rand(inv.balance ?? inv.total)} due
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                  Due {formatDate(inv.due_date)}. Use the invoice number as your payment reference.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn btn-primary btn-sm" to={inv.view_url}>
                    View invoice
                  </Link>
                  <a className="btn btn-ghost btn-sm" href={inv.pdf_url} target="_blank" rel="noreferrer">
                    Download invoice PDF
                  </a>
                </div>
              </div>
            )}

            {canRespond ? (
              <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!!busy}
                  onClick={() => respond('accepted')}
                >
                  {busy === 'accepted' ? 'Accepting…' : 'Accept quote'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: 'var(--red)' }}
                  disabled={!!busy}
                  onClick={() => respond('declined')}
                >
                  {busy === 'declined' ? 'Declining…' : 'Decline quote'}
                </button>
              </div>
            ) : (
              !inv && (
                <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
                  {q.status === 'accepted' && 'This quote has been accepted.'}
                  {q.status === 'declined' && 'This quote has been declined.'}
                  {q.status === 'expired' && 'This quote has expired and can no longer be accepted.'}
                  {q.status === 'draft' && 'This quote has not been sent yet.'}
                  {!['accepted', 'declined', 'expired', 'draft'].includes(q.status) &&
                    'This quote is no longer open for a response.'}
                </p>
              )
            )}
          </div>
        </div>
      </div>
      <div className="portal-foot">PrintShop Pro · Johannesburg · +27 11 880 2200 · hello@printshoppro.co.za</div>
    </div>
  );
}
