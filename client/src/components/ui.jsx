import { rand } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

// Renders an amount, or "—" when the server gated it (value === null).
export const Money = ({ value, className = '' }) => (
  <span className={`money ${className}`}>{rand(value)}</span>
);

const BADGE_MAP = {
  // orders
  in_production: ['In Production', 'b-cyan'], proofing: ['Proofing', 'b-amber'],
  ready: ['Ready', 'b-green'], completed: ['Completed', 'b-purple'],
  delivered: ['Delivered', 'b-grey'], cancelled: ['Cancelled', 'b-red'],
  // quotes
  draft: ['Draft', 'b-grey'], sent: ['Sent', 'b-cyan'], accepted: ['Accepted', 'b-green'],
  expired: ['Expired', 'b-red'], declined: ['Declined', 'b-red'],
  // invoices
  partial: ['Partial', 'b-amber'], paid: ['Paid', 'b-green'], overdue: ['Overdue', 'b-red'],
  // payments
  payment: ['Payment', 'b-green'], deposit: ['Deposit', 'b-purple'], refund: ['Refund', 'b-red'],
  // proofs
  awaiting: ['Awaiting', 'b-amber'], approved: ['Approved', 'b-green'], changes_requested: ['Changes', 'b-red'],
  // deliveries
  in_transit: ['In Transit', 'b-cyan'], failed: ['Failed', 'b-red'],
  // whatsapp
  read: ['Read', 'b-cyan'], queued: ['Queued', 'b-grey'],
  // stock
  in_stock: ['In stock', 'b-green'], low: ['Low', 'b-amber'], out: ['Out', 'b-red']
};
export const Badge = ({ value, label }) => {
  const [text, cls] = BADGE_MAP[value] || [label || value, 'b-grey'];
  return <span className={`badge ${cls}`}>{text}</span>;
};

export const Metric = ({ label, value, strip = 'var(--cyan)', foot, onClick, active }) => (
  <div
    className={`metric${onClick ? ' clickable' : ''}${active ? ' active' : ''}`}
    style={{ '--strip': strip }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    } : undefined}
  >
    <div className="m-label">{label}</div>
    <div className="m-val">{value}</div>
    {foot && <div className="m-foot">{foot}</div>}
  </div>
);

export function Modal({ title, sub, wide, onClose, children, footer }) {
  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h3>{title}</h3>{sub && <div className="mh-sub">{sub}</div>}</div>
          <div className="x" onClick={onClose}>✕</div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// "Captured by" row, pre-filled to the current user, on every form.
export function CapturedBy() {
  const { user } = useAuth();
  const now = new Date().toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="captured-row">
      <span className="cap-label">Captured by</span>
      <span className="mono" style={{ fontWeight: 500 }}>{user.first_name} {user.surname} — {user.role_label}</span>
      <span className="cap-meta">{now}</span>
    </div>
  );
}

export const Panel = ({ title, sub, actions, children }) => (
  <div className="panel">
    <div className="panel-head">
      <h3>{title}</h3>{sub && <span className="sub mono">{sub}</span>}
      <div className="spacer" />{actions}
    </div>
    {children}
  </div>
);
