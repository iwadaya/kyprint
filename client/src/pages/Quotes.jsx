import { useState } from 'react';
import { useFetch } from '../useFetch.js';
import { api, getToken } from '../api.js';
import { Metric, Panel, Money, Badge, Modal, CapturedBy } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, isThisMonth, monthFoot } from '../format.js';

const blankItem = () => ({ product_id: '', quantity: '1' });

const blank = () => ({
  customer_id: '',
  description: '',
  items: [blankItem()],
});

function toForm(quote) {
  if (!quote) return blank();
  return {
    id: quote.id,
    quote_number: quote.quote_number,
    customer_id: quote.customer_id,
    customer_name: quote.customer_name,
    customer_email: quote.customer_email,
    customer_phone: quote.customer_phone,
    description: quote.description || '',
    status: quote.status,
    subtotal: quote.subtotal,
    vat_amount: quote.vat_amount,
    total: quote.total,
    valid_until: quote.valid_until,
    items: (quote.items || []).length
      ? quote.items.map((i) => ({
          description: i.description,
          quantity: String(i.quantity),
          unit_price: i.unit_price,
          line_total: i.line_total,
        }))
      : [blankItem()],
  };
}

function validUntilPreview() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

async function fetchQuotePdf(quoteId) {
  const res = await fetch(`/api/quotes/${quoteId}/pdf`, {
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  });
  if (res.status === 401) {
    window.location.reload();
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    throw Object.assign(new Error(data?.error || 'Could not download PDF'), { data });
  }
  return res.blob();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Quotes() {
  const { can } = useAuth();
  const canCreate = can('quotes.create');
  const canWhatsApp = can('whatsapp.send');
  const canSeeMoney = can('finance.view');
  const { data: quotes, reload } = useFetch('/quotes');
  const { data: customers } = useFetch('/customers');
  const { data: products } = useFetch('/products');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const open = (quote) => {
    setErrors([]);
    setForm(toForm(quote));
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

  async function save() {
    setBusy(true);
    setErrors([]);
    const errs = [];
    if (!form.customer_id) errs.push('Customer is required');
    if (!form.description?.trim()) errs.push('Description is required');
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
    if (errs.length) {
      setErrors([...new Set(errs)]);
      setBusy(false);
      return;
    }

    try {
      await api('/quotes', {
        method: 'POST',
        body: {
          customer_id: form.customer_id,
          description: form.description.trim(),
          items: form.items
            .filter((i) => i.product_id)
            .map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) })),
        },
      });
      setForm(null);
      reload();
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!form?.id) return;
    setPdfBusy(true);
    setErrors([]);
    try {
      const blob = await fetchQuotePdf(form.id);
      triggerDownload(blob, `${form.quote_number || 'quote'}.pdf`);
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setPdfBusy(false);
    }
  }

  async function sendQuote(channel) {
    if (!form?.id) return;
    setSendBusy(channel);
    setErrors([]);
    try {
      // Download PDF first so staff can attach it to the email if needed.
      try {
        const blob = await fetchQuotePdf(form.id);
        triggerDownload(blob, `${form.quote_number || 'quote'}.pdf`);
      } catch {
        /* still open compose with the PDF link */
      }

      const res = await api(`/quotes/${form.id}/send`, {
        method: 'POST',
        body: { channel },
      });
      if (res.url) {
        if (channel === 'email') window.location.href = res.url;
        else window.open(res.url, '_blank', 'noopener,noreferrer');
      }
      reload();
      setForm((f) => (f ? { ...f, status: 'sent' } : f));
    } catch (e) {
      setErrors(e.data?.errors || [e.message]);
    } finally {
      setSendBusy(null);
    }
  }

  if (!quotes) return <div className="loading">Loading quotes…</div>;

  const month = quotes.filter((q) => isThisMonth(q.created_at));
  const openCount = month.filter((q) => q.status === 'sent' || q.status === 'draft').length;
  const accepted = month.filter((q) => q.status === 'accepted').length;
  const pipeline = month.some((q) => q.total === null)
    ? null
    : month.reduce((s, q) => s + Number(q.total || 0), 0);

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
  const vat = +(productsTotal * 0.15).toFixed(2);
  const total = +(productsTotal + vat).toFixed(2);
  const usedProductIds = new Set((form?.items || []).map((i) => i.product_id).filter(Boolean));
  const canSend = isEdit && canCreate && form.status !== 'expired' && form.status !== 'declined';

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Open Quotes" strip="var(--cyan)" value={openCount} foot={monthFoot()} />
        <Metric label="Accepted" strip="var(--green)" value={accepted} foot={monthFoot()} />
        <Metric label="Pipeline" strip="var(--purple)" value={<Money value={pipeline} />} foot={monthFoot()} />
      </div>

      <Panel
        title="Quotes"
        sub={`${quotes.length} total`}
        actions={
          canCreate && (
            <button type="button" className="btn btn-primary btn-sm btn-wide" onClick={() => open(null)}>
              + New quote
            </button>
          )
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Customer / Job</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Valid until</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr
                key={q.id}
                style={{ cursor: 'pointer' }}
                onClick={() => open(q)}
              >
                <td>
                  <span className="t-id">{q.quote_number}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{q.customer_name}</div>
                  <div className="t-sub">{q.description}</div>
                </td>
                <td>
                  <Badge value={q.status} />
                </td>
                <td>
                  <Money value={q.total} />
                </td>
                <td className="mono t-sub">{formatDate(q.valid_until)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {form && (
        <Modal
          title={isEdit ? 'Quote' : 'New Quote'}
          sub={isEdit ? form.quote_number : 'Expires automatically after 30 days'}
          wide
          onClose={() => setForm(null)}
          footer={
            <>
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginRight: 'auto' }}
                  onClick={downloadPdf}
                  disabled={pdfBusy || !!sendBusy}
                >
                  {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
                {isEdit ? 'Close' : 'Cancel'}
              </button>
              {!isEdit && (
                <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : 'Add quote'}
                </button>
              )}
            </>
          }
        >
          <CapturedBy />

          {isEdit && (
            <div className="row-2">
              <div className="field">
                <label>Quote number</label>
                <input className="input mono" value={form.quote_number} readOnly />
              </div>
              <div className="field">
                <label>Status</label>
                <div style={{ paddingTop: 8 }}>
                  <Badge value={form.status} />
                </div>
              </div>
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
            <label>Description / job</label>
            {isEdit ? (
              <input className="input" value={form.description} readOnly />
            ) : (
              <input
                className="input"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="e.g. Roll-up banners + flyers"
              />
            )}
          </div>

          <div className="field">
            <label>Valid until</label>
            <input
              className="input mono"
              value={isEdit ? formatDate(form.valid_until) : formatDate(validUntilPreview())}
              readOnly
            />
            {!isEdit && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Set automatically to 30 days from today. Quotes past this date expire on their own.
              </p>
            )}
          </div>

          <div className="section-title" style={{ marginTop: 8 }}>
            Products
          </div>
          {!isEdit && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              At least one product is required. Totals include 15% VAT.
            </p>
          )}

          {isEdit
            ? (form.items || []).map((it, idx) => (
                <div className="captured-row" key={idx} style={{ marginTop: 0, marginBottom: 8 }}>
                  <span className="cap-label">{it.description || 'Line'}</span>
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
                          {canSeeMoney ? ` — R ${Number(p.price).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Qty</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input mono"
                        type="number"
                        min="1"
                        step="1"
                        value={it.quantity}
                        onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                      />
                      {form.items.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeItem(idx)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

          {!isEdit && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: 12 }}>
              + Add product
            </button>
          )}

          {canSeeMoney && (
            <div className="row-2" style={{ marginTop: 8 }}>
              <div className="field">
                <label>Subtotal</label>
                <input className="input mono" value={`R ${productsTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} readOnly />
              </div>
              <div className="field">
                <label>VAT (15%)</label>
                <input className="input mono" value={`R ${vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} readOnly />
              </div>
              <div className="field">
                <label>Total</label>
                <input className="input mono" value={`R ${total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} readOnly />
              </div>
            </div>
          )}

          {canSend && (
            <div style={{ marginTop: 16 }}>
              <div className="section-title">Send quote</div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                Downloads the PDF and opens email or WhatsApp with a PDF link plus an accept/decline page for {form.customer_name}.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!!sendBusy || !form.customer_email}
                  onClick={() => sendQuote('email')}
                >
                  {sendBusy === 'email' ? 'Opening…' : 'Email PDF'}
                </button>
                {canWhatsApp && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: 'var(--green)', color: 'var(--on-accent)' }}
                    disabled={!!sendBusy || !form.customer_phone}
                    onClick={() => sendQuote('whatsapp')}
                  >
                    {sendBusy === 'whatsapp' ? 'Opening…' : 'WhatsApp PDF'}
                  </button>
                )}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="field-error" style={{ marginTop: 12 }}>
              {errors.join(' · ')}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
