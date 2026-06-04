import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money, Badge } from '../components/ui.jsx';

export default function Invoices() {
  const { data: invoices } = useFetch('/invoices');
  if (!invoices) return <div className="loading">Loading invoices…</div>;
  const sum = (f, pred = () => true) =>
    invoices.some(i => i[f] === null) ? null : invoices.filter(pred).reduce((s, i) => s + i[f], 0);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="Billed" strip="var(--cyan)" value={<Money value={sum('total')} />} />
        <Metric label="Outstanding" strip="var(--amber)" value={<Money value={sum('balance')} />} />
        <Metric label="Paid" strip="var(--green)" value={invoices.filter(i => i.status === 'paid').length} />
        <Metric label="Overdue" strip="var(--red)"
          value={<Money value={sum('balance', i => i.status === 'overdue')} />} />
      </div>
      <Panel title="Invoices" sub={`${invoices.length} total`}>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead>
          <tbody>
            {invoices.map(i => (
              <tr key={i.id}>
                <td><span className="t-id">{i.invoice_number}</span></td>
                <td style={{ fontWeight: 600 }}>{i.customer_name}</td>
                <td className="mono t-sub">{i.issue_date}</td>
                <td><Badge value={i.status} /></td>
                <td><Money value={i.total} /></td>
                <td><Money value={i.balance} className={i.balance ? 'amt-red' : ''} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
