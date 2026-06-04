import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money, Badge } from '../components/ui.jsx';

export default function Quotes() {
  const { data: quotes } = useFetch('/quotes');
  if (!quotes) return <div className="loading">Loading quotes…</div>;
  const open = quotes.filter(q => q.status === 'sent' || q.status === 'draft').length;
  const accepted = quotes.filter(q => q.status === 'accepted').length;

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Open Quotes" strip="var(--cyan)" value={open} />
        <Metric label="Accepted" strip="var(--green)" value={accepted} />
        <Metric label="Pipeline" strip="var(--purple)"
          value={<Money value={quotes.reduce((s, q) => q.total === null ? null : s + q.total, 0)} />} />
      </div>
      <Panel title="Quotes" sub={`${quotes.length} total`}>
        <table className="table">
          <thead><tr><th>Quote</th><th>Customer / Job</th><th>Status</th><th>Amount</th><th>Valid until</th></tr></thead>
          <tbody>
            {quotes.map(q => (
              <tr key={q.id}>
                <td><span className="t-id">{q.quote_number}</span></td>
                <td><div style={{ fontWeight: 600 }}>{q.customer_name}</div><div className="t-sub">{q.description}</div></td>
                <td><Badge value={q.status} /></td>
                <td><Money value={q.total} /></td>
                <td className="mono t-sub">{q.valid_until || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
