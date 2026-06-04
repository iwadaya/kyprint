import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money } from '../components/ui.jsx';

export default function Reminders() {
  const { data: rows } = useFetch('/reminders');
  if (!rows) return <div className="loading">Loading reminders…</div>;
  const total = rows.some(r => r.balance === null) ? null : rows.reduce((s, r) => s + r.balance, 0);

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Overdue Invoices" strip="var(--red)" value={rows.length} />
        <Metric label="Total Overdue" strip="var(--amber)" value={<Money value={total} />} />
        <Metric label="Oldest" strip="var(--cyan)"
          value={<span className="mono">{rows.length ? `${Math.max(...rows.map(r => r.days_overdue))}d` : '—'}</span>} />
      </div>
      <Panel title="Overdue Follow-ups" sub={`${rows.length} open`}
        actions={<button className="btn btn-primary btn-sm">Send all reminders</button>}>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Age</th><th>Next stage</th><th>Balance</th><th>Contact</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.invoice_number}>
                <td><span className="t-id">{r.invoice_number}</span></td>
                <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                <td><span className="badge b-red">{r.days_overdue}d overdue</span></td>
                <td className="mono">{r.next_stage === 1 ? '1st notice' : r.next_stage === 2 ? '2nd notice' : `${r.next_stage}th notice`}</td>
                <td><Money value={r.balance} className="amt-red" /></td>
                <td className="mono t-sub">{r.phone}</td>
                <td className="flex gap8">
                  <button className="btn btn-ghost btn-sm">WhatsApp</button>
                  <button className="btn btn-ghost btn-sm">Email</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: 24 }}>No overdue invoices 🎉</td></tr>}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
