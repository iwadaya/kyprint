import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Quotes from './pages/Quotes.jsx';
import Invoices from './pages/Invoices.jsx';
import Payments from './pages/Payments.jsx';
import Reminders from './pages/Reminders.jsx';
import Customers from './pages/Customers.jsx';
import AccessControl from './pages/AccessControl.jsx';
import Portal from './pages/Portal.jsx';
import QuoteRespond from './pages/QuoteRespond.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Products from './pages/Products.jsx';
import { Proofing, Stock, Deliveries, WhatsApp } from './pages/Catalog.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <Layout>{children}</Layout>;
}

// Routes that require a specific permission (e.g. owner-only Access Control).
function Gated({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Standalone, full-page, token-authenticated customer portal */}
      <Route path="/portal/:token" element={<Portal />} />
      <Route path="/quote/:token" element={<QuoteRespond />} />
      <Route path="/invoice/:token" element={<InvoiceView />} />

      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/orders" element={<Protected><Orders /></Protected>} />
      <Route path="/quotes" element={<Protected><Quotes /></Protected>} />
      <Route path="/proofing" element={<Protected><Proofing /></Protected>} />
      <Route path="/stock" element={<Protected><Stock /></Protected>} />
      <Route path="/products" element={<Protected><Products /></Protected>} />
      <Route path="/deliveries" element={<Protected><Deliveries /></Protected>} />
      <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
      <Route path="/payments" element={<Protected><Payments /></Protected>} />
      <Route path="/reminders" element={<Protected><Reminders /></Protected>} />
      <Route path="/customers" element={<Protected><Customers /></Protected>} />
      <Route path="/whatsapp" element={<Protected><WhatsApp /></Protected>} />
      <Route path="/access" element={<Protected><Gated perm="users.manage"><AccessControl /></Gated></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
