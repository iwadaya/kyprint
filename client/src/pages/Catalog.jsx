import { useFetch } from '../useFetch.js';
import { Metric, Panel, Badge, Money } from '../components/ui.jsx';

export function Proofing() {
  const { data: proofs } = useFetch('/proofs');
  if (!proofs) return <div className="loading">Loading proofs…</div>;
  const by = (s) => proofs.filter(p => p.status === s).length;
  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Awaiting Approval" strip="var(--amber)" value={by('awaiting')} />
        <Metric label="Approved" strip="var(--green)" value={by('approved')} />
        <Metric label="Changes Requested" strip="var(--red)" value={by('changes_requested')} />
      </div>
      {proofs.map(p => (
        <div className="panel" style={{ marginBottom: 12 }} key={p.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
            <div className="proof-thumb" style={{ width: 56, height: 56, flex: '0 0 56px' }}>▣</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.filename}</div>
              <div className="t-sub mono">{p.order_number} · {p.customer_name} · v{p.version}</div>
            </div>
            <Badge value={p.status} />
            <button className="btn btn-ghost btn-sm">Open proof</button>
          </div>
        </div>
      ))}
    </>
  );
}

export function Stock() {
  const { data: stock } = useFetch('/stock');
  if (!stock) return <div className="loading">Loading stock…</div>;
  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="SKUs Tracked" strip="var(--cyan)" value={stock.length} />
        <Metric label="Low Stock" strip="var(--amber)" value={stock.filter(s => s.state === 'low').length} />
        <Metric label="Out of Stock" strip="var(--red)" value={stock.filter(s => s.state === 'out').length} />
      </div>
      <Panel title="Materials & Consumables">
        <table className="table">
          <thead><tr><th>Item</th><th>Category</th><th>SKU</th><th>On Hand</th><th>Reorder At</th><th>Status</th></tr></thead>
          <tbody>
            {stock.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td><span className="badge b-grey">{s.category}</span></td>
                <td className="mono t-sub">{s.sku}</td>
                <td className="mono" style={{ fontWeight: 600 }}>{s.on_hand}</td>
                <td className="mono t-sub">{s.reorder_at}</td>
                <td><Badge value={s.state} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

export function Deliveries() {
  const { data: rows } = useFetch('/deliveries');
  if (!rows) return <div className="loading">Loading deliveries…</div>;
  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="In Transit" strip="var(--cyan)" value={rows.filter(d => d.status === 'in_transit').length} />
        <Metric label="Delivered" strip="var(--green)" value={rows.filter(d => d.status === 'delivered').length} />
        <Metric label="Awaiting Dispatch" strip="var(--amber)" value={rows.filter(d => d.status === 'awaiting').length} />
      </div>
      <Panel title="Deliveries & Dispatch">
        <table className="table">
          <thead><tr><th>Ref</th><th>Order</th><th>Customer</th><th>Carrier</th><th>Tracking</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id}>
                <td><span className="t-id">{d.reference}</span></td>
                <td className="mono t-sub">{d.order_number}</td>
                <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                <td>{d.carrier}</td>
                <td className="mono t-sub">{d.tracking_ref || '—'}</td>
                <td><Badge value={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

export function WhatsApp() {
  const { data: rows } = useFetch('/whatsapp');
  if (!rows) return <div className="loading">Loading messages…</div>;
  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="Total Sent" strip="var(--cyan)" value={rows.length} />
        <Metric label="Delivered" strip="var(--green)" value={rows.filter(w => w.status === 'delivered').length} />
        <Metric label="Read" strip="var(--cyan)" value={rows.filter(w => w.status === 'read').length} />
        <Metric label="Failed" strip="var(--red)" value={rows.filter(w => w.status === 'failed').length} />
      </div>
      <Panel title="Message Log" sub="recent">
        <div className="panel-body" style={{ padding: 14 }}>
          {rows.map(w => (
            <div className="panel" style={{ marginBottom: 10 }} key={w.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                <span className="avatar-sm" style={{ background: 'linear-gradient(135deg,#52d68a,#2fae6a)', width: 36, height: 36 }}>
                  {w.customer_name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{w.customer_name}</div>
                  <div className="t-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>{w.body}</div>
                </div>
                <Badge value={w.status} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
