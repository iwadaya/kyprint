import { useState } from 'react';
import { useFetch } from '../useFetch.js';
import { api } from '../api.js';
import { Metric } from '../components/ui.jsx';

export default function AccessControl() {
  const { data: users, reload } = useFetch('/users');
  const { data: perms } = useFetch('/users/permissions');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({});   // userId -> Set of keys
  const [savingId, setSavingId] = useState(null);

  if (!users || !perms) return <div className="loading">Loading access control…</div>;

  const categories = [...new Set(perms.map(p => p.category))];

  const keysFor = (u) => draft[u.id] ?? new Set(u.permissions);
  const toggle = (u, key) => {
    const next = new Set(keysFor(u));
    next.has(key) ? next.delete(key) : next.add(key);
    setDraft(d => ({ ...d, [u.id]: next }));
  };
  async function save(u) {
    setSavingId(u.id);
    try {
      await api(`/users/${u.id}/permissions`, { method: 'PUT', body: { permissions: [...keysFor(u)] } });
      setDraft(d => { const n = { ...d }; delete n[u.id]; return n; });
      reload();
    } finally { setSavingId(null); }
  }

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Team Members" strip="var(--cyan)" value={users.length} />
        <Metric label="Permissions" strip="var(--purple)" value={perms.length} />
        <Metric label="Owners / Admins" strip="var(--green)" value={users.filter(u => u.is_owner).length} />
      </div>

      <div className="flex aic gap8" style={{ marginBottom: 14 }}>
        <div className="section-title">Users &amp; Permissions</div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm">+ Invite user</button>
      </div>

      {users.map(u => {
        const isOpen = openId === u.id;
        const granted = keysFor(u);
        const dirty = !!draft[u.id];
        return (
          <div className={`user-acc ${isOpen ? 'open' : ''}`} key={u.id}>
            <div className="user-acc-head" onClick={() => setOpenId(isOpen ? null : u.id)}>
              <span className="avatar-sm" style={{
                width: 36, height: 36,
                background: u.is_owner ? 'linear-gradient(135deg,#00d4aa,#03a585)' : 'linear-gradient(135deg,#52d68a,#2fae6a)'
              }}>{u.avatar_initials}</span>
              <div><div className="ua-name">{u.first_name} {u.surname}</div>
                <div className="ua-role mono">{u.role_label}</div></div>
              <span className="ua-count">{u.is_owner ? 16 : granted.size} / 16</span>
              <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </div>
            <div className="perm-body">
              {u.is_owner && <div className="gate-note" style={{ marginTop: 12, color: 'var(--cyan)', background: 'var(--cyan-soft)' }}>Owner has all permissions — locked</div>}
              <div className="perm-grid">
                {categories.map(cat => (
                  <div key={cat} style={{ display: 'contents' }}>
                    <div className="perm-cat">{cat}</div>
                    {perms.filter(p => p.category === cat).map(p => {
                      const on = u.is_owner || granted.has(p.key);
                      return (
                        <div className="perm-row" key={p.key}>
                          <div><span className="p-name">{p.label}</span><span className="p-key">{p.key}</span></div>
                          <div className={`toggle ${on ? 'on' : ''}`}
                            onClick={() => !u.is_owner && toggle(u, p.key)}
                            style={{ opacity: u.is_owner ? 0.5 : 1, cursor: u.is_owner ? 'not-allowed' : 'pointer' }} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {!u.is_owner && (
                <div className="flex gap8 mt16" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" disabled={!dirty}
                    onClick={() => setDraft(d => { const n = { ...d }; delete n[u.id]; return n; })}>Reset</button>
                  <button className="btn btn-primary btn-sm" disabled={!dirty || savingId === u.id} onClick={() => save(u)}>
                    {savingId === u.id ? 'Saving…' : 'Save changes'}</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
