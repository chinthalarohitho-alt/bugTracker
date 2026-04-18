"use client";
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthProvider';

const ROLE_OPTIONS = [
  'Founder', 'HR Admin', 'Sales Manager',
  'Developer', 'QA Engineer', 'Product Manager', 'Project Manager',
  'Designer', 'DevOps', 'Tech Lead', 'Engineering Manager',
];

export default function OnboardingScreen() {
  const { data: session } = useSession();
  const { completeOnboarding, globalSettings } = useAuth();
  const [name, setName] = useState(session?.user?.name || '');
  const [role, setRole] = useState('');
  const [avatar] = useState(session?.user?.image || '');
  const [saving, setSaving] = useState(false);

  const nameExists = name.trim() && (globalSettings?.assignees || []).some(a => {
    const n = (typeof a === 'object' ? a.name : a || '').toLowerCase().trim();
    return n === name.trim().toLowerCase();
  });
  const canSubmit = name.trim() && role && !saving && !nameExists;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    await completeOnboarding(name.trim(), role, avatar);
  };

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      backgroundColor: '#ffffff',
      fontFamily: 'var(--font-family)'
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 24
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tapzaLogo.png" alt="Tapza" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-main)' }}>Tapza Internal Portal</span>
        </div>

        {/* Heading */}
        <div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 600,
            color: 'var(--color-text-main)',
            letterSpacing: '-0.02em', margin: 0, marginBottom: 6
          }}>
            Set up your profile
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            A couple of details and you&rsquo;re in.
          </p>
        </div>

        {/* Identity preview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 0',
          borderTop: '1px solid var(--chrome-border)',
          borderBottom: '1px solid var(--chrome-border)'
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            backgroundColor: '#2563eb', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.95rem', fontWeight: 600,
            overflow: 'hidden', position: 'relative', flexShrink: 0
          }}>
            {avatar && /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />}
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name || 'Your name'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {session?.user?.email || 'Signed in with Google'}
            </div>
          </div>
        </div>

        {/* Name */}
        <Field label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            spellCheck={false}
            autoComplete="off"
            autoFocus
            style={inputStyle}
          />
          {nameExists && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
              fontSize: '0.75rem', color: '#b45309', fontWeight: 500
            }}>
              <AlertCircle size={12} />
              This name already exists — add a surname to differentiate.
            </div>
          )}
        </Field>

        {/* Role */}
        <Field label="Role">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8,
            width: '100%'
          }}>
            {ROLE_OPTIONS.map(r => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    padding: '9px 12px', borderRadius: 8,
                    border: active ? '1px solid var(--color-text-main)' : '1px solid var(--chrome-border)',
                    backgroundColor: active ? 'var(--chrome-bg-subtle)' : 'transparent',
                    color: 'var(--color-text-main)',
                    fontSize: '0.8rem', fontWeight: active ? 600 : 500,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background-color 0.12s, border-color 0.12s'
                  }}>
                  {r}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Submit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 16px', borderRadius: 8,
              border: 'none',
              backgroundColor: '#0f172a',
              color: 'white',
              fontSize: '0.88rem', fontWeight: 500,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
              fontFamily: 'var(--font-family)',
              transition: 'background-color 0.15s'
            }}>
            {saving ? 'Setting up…' : 'Continue'} {!saving && <ArrowRight size={15} />}
          </button>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', textAlign: 'center', margin: 0 }}>
            Signed in as {session?.user?.email}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--chrome-border)',
  backgroundColor: 'var(--chrome-bg-raised)',
  fontSize: '0.88rem', color: 'var(--color-text-main)',
  fontFamily: 'var(--font-family)', outline: 'none'
};
