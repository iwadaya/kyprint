import { useFetch } from '../useFetch.js';
import { Metric, Panel, Money, Badge } from '../components/ui.jsx';
import { rand } from '../api.js';

export default function Dashboard() {
  const { data: d } = useFetch('/dashboard');
  const { data: orders } = useFetch('/orders');
  const { data: proofs } = useFetch('/proofs');
  if (!d) return <div className="loading">Loading dashboard…</div>;

  const fin = d.can_see_financials;

  return (
    <>
      {!fin && (
        <div className="flex aic gap8" style={{ marginBottom: 16 }}>
          <span className="gate-note">🔒 Financial figures hidden for your role</span>
        </div>
      )}

      <div className="grid cols-4">
        {fin ? (
          <>
            <Metric label="Revenue · This Month" strip="var(--cyan)"
              value={<Money value={d.revenue_month} />}
              foot={<><span className="trend up mono">▲ 12.4%</span><span>vs last month</span></>} />
            <Metric label="Outstanding" strip="var(--amber)" value={<Money value={d.outstanding} />}
              foot={<span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{d.overdue_count} overdue</span>} />
            <Metric label="Deposits Held" strip="var(--purple)" value={<Money value={d.deposits_held} />} />
            <Metric label="Active Orders" strip="var(--green)" value={d.active_orders}
              foot={<span className="trend up mono">in queue</span>} />
          </>
        ) : (
          <>
            <Metric label="Active Orders" strip="var(--cyan)" value={d.active_orders} />
            <Metric label="In Production" strip="var(--amber)" value={d.in_production} />
            <Metric label="Proofs to Send" strip="var(--purple)" value={d.awaiting_proof} />
            <Metric label="Out for Delivery" strip="var(--green)" value={d.out_for_delivery} />
          </>
        )}
      </div>

      <div className="grid cols-2 mt16" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
        <Panel title={fin ? 'Production Queue' : 'My Production Queue'} sub={`${orders?.length || 0} live`}>
          <table className="table">
            <thead><tr><th>Order</th><th>Customer / Item</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {(orders || []).slice(0, 6).map(o => (
                <tr key={o.id}>
                  <td><span className="t-id">{o.order_number}</span></td>
                  <td><div style={{ fontWeight: 600 }}>{o.customer_name}</div><div className="t-sub">{o.description}</div></td>
                  <td><Badge value={o.status} /></td>
                  <td><Money value={o.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Awaiting Proof" sub={`${(proofs || []).filter(p => p.status === 'awaiting').length}`}>
          <div className="panel-body" style={{ padding: '6px 18px 14px' }}>
            {(proofs || []).slice(0, 4).map(p => (
              <div className="proof-row" key={p.id}>
                <div className="proof-thumb">▣</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.filename}</div>
                  <div className="t-sub mono">{p.order_number} · {p.customer_name}</div>
                </div>
                <span style={{ marginLeft: 'auto' }}><Badge value={p.status} /></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
