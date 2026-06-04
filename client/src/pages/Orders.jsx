import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money, Badge } from '../components/ui.jsx';

export default function Orders() {
  const { data: orders } = useFetch('/orders');
  if (!orders) return <div className="loading">Loading orders…</div>;
  const by = (s) => orders.filter(o => o.status === s).length;

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="In Production" strip="var(--cyan)" value={by('in_production')} />
        <Metric label="Proofing" strip="var(--amber)" value={by('proofing')} />
        <Metric label="Ready / Collect" strip="var(--green)" value={by('ready')} />
        <Metric label="Total Orders" strip="var(--purple)" value={orders.length} />
      </div>
      <Panel title="All Orders" sub={`${orders.length} total`}>
        <table className="table">
          <thead><tr><th>Order</th><th>Customer / Item</th><th>Status</th><th>Total</th><th>Deposit</th><th>Due</th><th>Captured by</th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td><span className="t-id">{o.order_number}</span></td>
                <td><div style={{ fontWeight: 600 }}>{o.customer_name}</div><div className="t-sub">{o.description}</div></td>
                <td><Badge value={o.status} /></td>
                <td><Money value={o.total} /></td>
                <td><Money value={o.deposit_amount} className="amt-purple" /></td>
                <td className="mono t-sub">{o.due_date || '—'}</td>
                <td className="t-sub">{o.captured_by || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
