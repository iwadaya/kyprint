import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money, Badge } from '../components/ui.jsx';
import { formatDate, isThisMonth, monthFoot } from '../format.js';

export default function Invoices() {
  const { data: invoices } = useFetch('/invoices');
  if (!invoices) return <div className="loading">Loading invoices…</div>;

  const month = invoices.filter(i => isThisMonth(i.issue_date));
  const sum = (f, rows = month, pred = () => true) =>
    rows.some(i => i[f] === null) ? null : rows.filter(pred).reduce((s, i) => s + i[f], 0);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="Billed" strip="var(--cyan)" value={<Money value={sum('total')} />} foot={monthFoot()} />
        <Metric label="Outstanding" strip="var(--amber)" value={<Money value={sum('balance')} />} foot={monthFoot()} />
        <Metric label="Paid" strip="var(--green)" value={month.filter(i => i.status === 'paid').length} foot={monthFoot()} />
        <Metric label="Overdue" strip="var(--red)" value={<Money value={sum('balance', month, i => i.status === 'overdue')} />} foot={monthFoot()} />
      </div>
      <Panel title="Invoices" sub={`${invoices.length} total`}>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Due</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead>
          <tbody>
            {invoices.map(i => (
              <tr key={i.id}>
                <td><span className="t-id">{i.invoice_number}</span></td>
                <td style={{ fontWeight: 600 }}>{i.customer_name}</td>
                <td className="mono t-sub">{formatDate(i.issue_date)}</td>
                <td className="mono t-sub">{formatDate(i.due_date)}</td>
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
