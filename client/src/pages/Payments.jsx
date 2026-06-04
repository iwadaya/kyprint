import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money, Badge } from '../components/ui.jsx';

export default function Payments() {
  const { data: payments } = useFetch('/payments');
  if (!payments) return <div className="loading">Loading payments…</div>;
  const total = (t) => payments.some(p => p.amount === null) ? null
    : payments.filter(p => p.type === t).reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Received" strip="var(--green)" value={<Money value={total('payment')} />} />
        <Metric label="Deposits Held" strip="var(--purple)" value={<Money value={total('deposit')} />} />
        <Metric label="Refunds" strip="var(--red)" value={<Money value={total('refund')} />} />
      </div>
      <Panel title="Payment Ledger" sub={`${payments.length} entries`}>
        <table className="table">
          <thead><tr><th>Ref</th><th>Linked to</th><th>Method</th><th>Type</th><th>Amount</th><th>Date</th><th>Captured by</th></tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td><span className="t-id">{p.reference}</span></td>
                <td className="mono t-sub">{p.invoice_number || p.order_number || '—'}</td>
                <td className="mono">{p.method.toUpperCase()}</td>
                <td><Badge value={p.type} /></td>
                <td><Money value={p.amount}
                  className={p.type === 'refund' ? 'amt-red' : p.type === 'deposit' ? 'amt-purple' : 'amt-green'} /></td>
                <td className="mono t-sub">{p.paid_at}</td>
                <td className="t-sub">{p.captured_by || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
