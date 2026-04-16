"use client";
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAuth } from './AuthProvider';

const ROLE_OPTIONS = [
  'Founder',
  'HR Admin',
  'Sales Manager',
  'Developer',
  'QA Engineer',
  'Product Manager',
  'Project Manager',
  'Designer',
  'DevOps',
  'Tech Lead',
  'Engineering Manager',
];


export default function OnboardingScreen() {
  const { data: session } = useSession();
  const { completeOnboarding } = useAuth();
  const [name, setName] = useState(session?.user?.name || '');
  const [role, setRole] = useState('');
  const [avatar] = useState(session?.user?.image || '');
  const [saving, setSaving] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const { globalSettings } = useAuth();
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', backgroundColor: 'var(--color-bg-body)',
      fontFamily: 'var(--font-family)',
    }}>
      {/* Left — Form */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px 32px',
        backgroundColor: 'var(--color-bg-surface)',
        maxWidth: '520px', minWidth: '400px',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '36px', justifyContent: 'center' }}>
            <img src="/tapzaLogo.png" alt="Tapza" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-text-main)' }}>Tapza Bug Portal</span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '6px', letterSpacing: '-0.03em' }}>
            Set up your profile
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '32px', lineHeight: 1.5, fontWeight: '500' }}>
            Welcome! Complete your profile to get started.
          </p>

          {/* Avatar preview — Google profile pic */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', gap: '8px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              backgroundColor: '#2563eb', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: '800', overflow: 'hidden',
              border: '3px solid var(--color-border)', position: 'relative',
            }}>
              {avatar ? (
                <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
              ) : null}
              {name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?'}
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
              Using your Google profile photo
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
              {uploading ? 'Uploading...' : 'Click to upload photo (optional)'}
            </span>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--color-text-main)', marginBottom: '6px' }}>
              Display Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              spellCheck={false}
              autoComplete="off"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '10px',
                border: '1.5px solid var(--color-border)', fontSize: '0.9rem',
                fontWeight: '400', backgroundColor: 'var(--color-bg-body)',
                color: 'var(--color-text-main)', outline: 'none',
              }}
            />
            {nameExists && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                marginTop: '8px', padding: '8px 12px', borderRadius: '8px',
                backgroundColor: 'color-mix(in srgb, #f59e0b 8%, var(--color-bg-surface))',
                border: '1px solid color-mix(in srgb, #f59e0b 20%, var(--color-bg-surface))',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: '500' }}>
                  This name already exists. Please add your surname to differentiate.
                </span>
              </div>
            )}
          </div>

          {/* Role — Material dropdown */}
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--color-text-main)', marginBottom: '6px' }}>
              Role <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div
              onClick={() => setRoleOpen(!roleOpen)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '10px',
                border: roleOpen ? '1.5px solid #2563eb' : '1.5px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-body)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: roleOpen ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: '400', color: role ? 'var(--color-text-main)' : 'var(--color-text-light)' }}>
                {role || 'Select your role'}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: roleOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {roleOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                backgroundColor: 'var(--color-bg-surface)', borderRadius: '12px',
                border: '1px solid var(--color-border)',
                boxShadow: '0 12px 32px -4px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.04)',
                padding: '6px', zIndex: 10, maxHeight: '240px', overflowY: 'auto',
              }}>
                {ROLE_OPTIONS.map(r => (
                  <div
                    key={r}
                    onClick={() => { setRole(r); setRoleOpen(false); }}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: role === r ? 'color-mix(in srgb, #2563eb 8%, var(--color-bg-surface))' : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (role !== r) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                    onMouseLeave={(e) => { if (role !== r) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{
                      fontSize: '0.85rem', fontWeight: role === r ? '700' : '500',
                      color: role === r ? '#2563eb' : 'var(--color-text-main)',
                    }}>{r}</span>
                    {role === r && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: 'none', backgroundColor: '#2563eb', color: 'white',
              fontSize: '0.9rem', fontWeight: '700', cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {saving ? 'Setting up...' : 'Continue to workspace'}
          </button>

          <p style={{ marginTop: '16px', fontSize: '0.7rem', color: 'var(--color-text-light)', textAlign: 'center' }}>
            Signed in as {session?.user?.email}
          </p>
        </div>
      </div>

      {/* Right — Illustration */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px', overflow: 'hidden',
        background: 'linear-gradient(160deg, var(--color-bg-body) 0%, color-mix(in srgb, #2563eb 6%, var(--color-bg-body)) 100%)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <img src="/onboarding.svg" alt="Welcome" style={{ width: '100%', maxWidth: '360px', margin: '0 auto', display: 'block' }} />
          <h2 style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', fontWeight: '800', color: 'var(--color-text-main)', marginTop: '28px', letterSpacing: '-0.03em' }}>
            Welcome to the team!
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.5, fontWeight: '500' }}>
            Set up your profile to start tracking bugs across Pharmacy, Clinic, Laboratory & Hospital ERPs.
          </p>
        </div>
      </div>
    </div>
  );
}
