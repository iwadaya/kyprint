import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('thandiwe@printshoppro.co.za');
  const [password, setPassword] = useState('printshop2026');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setBusy(true); setErr('');
    try { await login(email, password); nav('/'); }
    catch (e) { setErr(e.message || 'Login failed'); }
    finally { setBusy(false); }
  }

  const quick = (em) => { setEmail(em); setPassword('printshop2026'); };

  return (
    <div className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">P</div>
          <div><h1>PrintShop&nbsp;Pro</h1><small>JOHANNESBURG · EST 2019</small></div>
        </div>
        <h2>Sign in to your workspace</h2>
        <p className="lsub">Manage orders, quotes & production for your shop.</p>
        <form onSubmit={submit}>
          <div className="field"><label>Email address</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          {err && <div className="field-error">{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
                  disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="quick-login">
          <button onClick={() => quick('thandiwe@printshoppro.co.za')}>
            <span className="ql-role">OWNER</span><span className="ql-name">Thandiwe M.</span></button>
          <button onClick={() => quick('sipho@printshoppro.co.za')}>
            <span className="ql-role">EMPLOYEE</span><span className="ql-name">Sipho N.</span></button>
        </div>
        <div className="login-foot">SECURED · POPIA COMPLIANT · v2.4.0</div>
      </div>
    </div>
  );
}
