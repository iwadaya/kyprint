import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ICONS, Icon } from './icons.jsx';

const NAV = [
  { sec: 'OPERATIONS' },
  { to: '/', icon: 'dash', label: 'Dashboard', end: true },
  { to: '/orders', icon: 'orders', label: 'Orders' },
  { to: '/quotes', icon: 'quote', label: 'Quotes' },
  { to: '/proofing', icon: 'proof', label: 'Proofing' },
  { to: '/stock', icon: 'stock', label: 'Stock' },
  { to: '/deliveries', icon: 'deliv', label: 'Deliveries' },
  { sec: 'FINANCE' },
  { to: '/invoices', icon: 'invoice', label: 'Invoices' },
  { to: '/payments', icon: 'pay', label: 'Payments' },
  { to: '/reminders', icon: 'remind', label: 'Payment Reminders' },
  { sec: 'CRM' },
  { to: '/customers', icon: 'cust', label: 'Customers' },
  { to: '/whatsapp', icon: 'whatsapp', label: 'WhatsApp' },
  { sec: 'ADMIN', perm: 'users.manage' },
  { to: '/access', icon: 'access', label: 'Access Control', perm: 'users.manage' }
];

const TITLES = {
  '/': ['Dashboard', '/ overview'], '/orders': ['Orders', '/ production queue'],
  '/quotes': ['Quotes', '/ pending estimates'], '/proofing': ['Proofing', '/ awaiting approval'],
  '/stock': ['Stock', '/ materials & consumables'], '/deliveries': ['Deliveries', '/ dispatch'],
  '/invoices': ['Invoices', '/ billing'], '/payments': ['Payments', '/ receipts & deposits'],
  '/reminders': ['Payment Reminders', '/ overdue follow-ups'], '/customers': ['Customers', '/ directory'],
  '/whatsapp': ['WhatsApp Notifications', '/ message centre'], '/access': ['Access Control', '/ users & permissions']
};

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const { pathname } = useLocation();
  const [title, crumb] = TITLES[pathname] || ['', ''];

  return (
    <div className="app-flex">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-name">PrintShop<small>PRO · JHB</small></div>
        </div>
        <nav className="nav">
          {NAV.map((n, i) => {
            if (n.perm && !can(n.perm)) return null;
            if (n.sec) return <div className="nav-section" key={i}>{n.sec}</div>;
            return (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon d={ICONS[n.icon]} /><span>{n.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="user-chip" onClick={logout} title="Sign out">
          <div className={`avatar ${user.is_owner ? 'owner' : ''}`}>{user.avatar_initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="u-name">{user.first_name} {user.surname}</div>
            <div className="u-role">{user.role_label}</div>
          </div>
          <svg className="ic" style={{ marginLeft: 'auto', width: 15, color: 'var(--text-faint)' }}
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          </svg>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="page-title">{title}</div>
            <div className="crumb">{crumb}</div>
          </div>
          <div className="topbar-spacer" />
          <div className="search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4-4" />
            </svg>
            <input placeholder="Search orders, customers…" />
          </div>
          <button className="icon-btn"><span className="dot" />
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </svg>
          </button>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
