"use client";
import { useState, useEffect } from 'react';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import { useSession } from 'next-auth/react';
import { Save, Check, User, Shield, Link2, Mail } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const ROLE_OPTIONS = [
  'Founder', 'HR Admin', 'Sales Manager',
  'Developer', 'QA Engineer', 'Product Manager', 'Project Manager',
  'Designer', 'DevOps', 'Tech Lead', 'Engineering Manager',
];

export default function ProfilePage() {
  const { currentReporter, getInitials, getRoleForProfile, setRoleForProfile, globalSettings, setGlobalSettings } = useAuth();
  const { data: session } = useSession();

  const [name, setName] = useState(currentReporter || '');
  const [role, setRole] = useState('');
  const [avatar, setAvatar] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentReporter || !globalSettings?.assignees) return;
    setName(currentReporter);
    setLinkedin(localStorage.getItem(`bugTracker_linkedin_${currentReporter}`) || '');

    const me = globalSettings.assignees.find(a => (typeof a === 'object' ? a.name : a) === currentReporter);
    if (me && typeof me === 'object') {
      setAvatar(me.avatar || session?.user?.image || '');
      setRole(me.role || (getRoleForProfile ? getRoleForProfile(currentReporter) : 'Team Member'));
    } else {
      setAvatar(session?.user?.image || '');
      setRole(getRoleForProfile ? getRoleForProfile(currentReporter) : 'Team Member');
    }
  }, [currentReporter, globalSettings]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    if (setRoleForProfile) setRoleForProfile(name.trim(), role);
    localStorage.setItem(`bugTracker_linkedin_${name.trim()}`, linkedin);
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      const assignees = (s.assignees || []).map(a => {
        const aName = typeof a === 'object' ? a.name : a;
        if (aName === currentReporter) {
          return { ...(typeof a === 'object' ? a : { name: a }), name: name.trim(), avatar, linkedin, role };
        }
        return a;
      });
      const updated = { ...s, assignees };
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      if (setGlobalSettings) setGlobalSettings(updated);

      if (name.trim() !== currentReporter) {
        try {
          const bugsRes = await fetch('/api/bugs');
          const bugsData = await bugsRes.json();
          const bugs = bugsData.bugs || bugsData || [];
          const toUpdate = bugs.filter(b => b.assignee === currentReporter || b.reporter === currentReporter);
          await Promise.all(toUpdate.map(b => {
            const changes = {};
            if (b.assignee === currentReporter) changes.assignee = name.trim();
            if (b.reporter === currentReporter) changes.reporter = name.trim();
            return fetch('/api/bugs', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...b, ...changes })
            });
          }));
        } catch {}
        localStorage.setItem('bugTracker_reporter', name.trim());
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  if (!currentReporter || !globalSettings) return (
    <main style={{ maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        Loading profile...
      </div>
    </main>
  );

  const email = session?.user?.email || '';
  const initials = getInitials(name || currentReporter);

  const saveButton = (
    <button
      onClick={handleSave}
      disabled={saving}
      className={saved ? 'btn' : 'btn btn-primary'}
      style={{
        border: 'none',
        backgroundColor: saved ? '#22c55e' : undefined,
        color: saved ? 'white' : undefined,
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.7 : 1
      }}>
      {saved ? <Check size={14} /> : <Save size={14} />}
      {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
    </button>
  );

  return (
    <main style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Profile"
        subtitle="Update your name, role, photo, and social links."
        actions={saveButton}
      />

      {/* IDENTITY */}
      <section style={{ marginTop: 24 }}>
        <SectionHeader icon={User} color="#2563eb" label="Identity" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: '1px solid var(--chrome-border)', borderBottom: '1px solid var(--chrome-border)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: '#6366f1', color: 'white',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden',
            border: '1px solid var(--color-border)',
            flexShrink: 0
          }}>
            {avatar
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
              : <span>{initials}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
              {capitalizeName(name || currentReporter)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Mail size={11} /> {email || 'no email linked'}
            </div>
          </div>
        </div>

        <Row label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            spellCheck={false}
            style={inputStyle}
          />
        </Row>

        <Row label="Photo URL">
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder={session?.user?.image ? 'Using Google photo — paste URL to override' : 'Paste image URL…'}
            spellCheck={false}
            style={inputStyle}
          />
          {avatar && session?.user?.image && avatar !== session.user.image && (
            <button
              type="button"
              onClick={() => setAvatar(session?.user?.image || '')}
              style={{
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid var(--chrome-border)',
                backgroundColor: 'transparent',
                fontSize: '0.75rem', fontWeight: 500,
                color: 'var(--color-text-muted)',
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              Reset
            </button>
          )}
        </Row>

        <Row label="Email" readOnly>
          <div style={{ ...inputStyle, color: 'var(--color-text-muted)', cursor: 'not-allowed' }}>
            {email || '—'}
          </div>
        </Row>
      </section>

      {/* ROLE */}
      <section style={{ marginTop: 28 }}>
        <SectionHeader icon={Shield} color="#8b5cf6" label="Role" />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 8, padding: '16px 0',
          borderTop: '1px solid var(--chrome-border)'
        }}>
          {ROLE_OPTIONS.map(r => {
            const active = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  padding: '10px 12px', borderRadius: 8,
                  border: active ? '1px solid var(--color-text-main)' : '1px solid var(--chrome-border)',
                  backgroundColor: active ? 'var(--chrome-bg-subtle)' : 'transparent',
                  color: 'var(--color-text-main)',
                  fontSize: '0.82rem', fontWeight: active ? 600 : 500,
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background-color 0.12s, border-color 0.12s'
                }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: active ? '4px solid var(--color-text-main)' : '1.5px solid var(--chrome-border)',
                  backgroundColor: active ? 'var(--color-bg-surface)' : 'transparent',
                  flexShrink: 0, transition: 'all 0.12s'
                }} />
                {r}
              </button>
            );
          })}
        </div>
      </section>

      {/* SOCIAL */}
      <section style={{ marginTop: 28 }}>
        <SectionHeader icon={Link2} color="#0a66c2" label="Social" />
        <Row label="LinkedIn" noBorder>
          <input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
            spellCheck={false}
            style={inputStyle}
          />
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noopener noreferrer" style={{
              fontSize: '0.75rem', color: '#0a66c2', fontWeight: 500,
              textDecoration: 'none', whiteSpace: 'nowrap'
            }}>
              View →
            </a>
          )}
        </Row>
      </section>
    </main>
  );
}

function SectionHeader({ icon: Icon, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <Icon size={15} color={color} strokeWidth={2} />
      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>{label}</div>
    </div>
  );
}

function Row({ label, children, noBorder }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      alignItems: 'center',
      gap: 16,
      padding: '14px 0',
      borderTop: noBorder ? '1px solid var(--chrome-border)' : undefined,
      borderBottom: '1px solid var(--chrome-border)'
    }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1, minWidth: 0,
  padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--chrome-border)',
  backgroundColor: 'var(--chrome-bg-raised)',
  fontSize: '0.86rem', color: 'var(--color-text-main)',
  fontFamily: 'var(--font-family)', outline: 'none'
};

