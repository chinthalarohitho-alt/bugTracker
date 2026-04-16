"use client";
import { useState } from 'react';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import { useSession } from 'next-auth/react';
import { Mail, Link2, Search } from 'lucide-react';
import GlobalHeader from '../components/GlobalHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import Link from 'next/link';

const AVATAR_COLORS = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6'];
const BG_COLORS = ['#dbeafe', '#ede9fe', '#d1fae5', '#fef3c7', '#fee2e2', '#fce7f3', '#cffafe', '#ecfccb', '#e0e7ff', '#ccfbf1'];

const ROLE_OPTIONS = [
  'Founder', 'HR Admin', 'Sales Manager',
  'Developer', 'QA Engineer', 'Product Manager', 'Project Manager',
  'Designer', 'DevOps', 'Tech Lead', 'Engineering Manager',
];

export default function TeamPage() {
  const { currentReporter, globalSettings, getInitials, getAvatar, getRoleForProfile, setRoleForProfile, globalSearchQuery } = useAuth();
  const { data: session } = useSession();
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupRole, setSetupRole] = useState('Developer');
  const [saving, setSaving] = useState(false);

  const members = (globalSettings?.assignees || []).filter(a => {
    const name = typeof a === 'object' ? a.name : a;
    return name && name !== 'Not Assigned' && name !== 'Unassigned';
  }).filter((a, i, arr) => {
    const name = typeof a === 'object' ? a.name : a;
    return arr.findIndex(b => (typeof b === 'object' ? b.name : b) === name) === i;
  });

  const search = globalSearchQuery || '';
  const filtered = search.trim()
    ? members.filter(m => {
        const name = (typeof m === 'object' ? m.name : m).toLowerCase();
        const email = (typeof m === 'object' ? m.email || '' : '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : members;

  if (!currentReporter || !globalSettings) return <LoadingOverlay message="Loading team" />;

  const handleSetup = async () => {
    if (!setupName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      const normalize = (n) => (typeof n === 'object' ? n.name : n || '').toLowerCase().trim();
      const exists = (s.assignees || []).some(a => normalize(a) === setupName.toLowerCase().trim());
      if (!exists) {
        const updated = { ...s, assignees: [...(s.assignees || []), { name: setupName.trim(), avatar: '', color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)], role: setupRole }] };
        await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      }
      if (setRoleForProfile) setRoleForProfile(setupName.trim(), setupRole);
      setShowSetup(false);
      window.location.reload();
    } catch {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: '20px 20px 80px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <GlobalHeader placeholder="Search team members..." />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
            Team Members
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Manage team members, set roles, and track progress.
          </p>
        </div>
      </div>

      {filtered.length === 0 && search ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          No members found for "{search}"
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <img src="/team-spirit.svg" alt="Team" style={{ width: '100%', maxWidth: '280px', margin: '0 auto 24px', display: 'block' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '6px' }}>No team members yet</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Members are added when they sign in or you can add manually.</p>
          <button onClick={() => setShowSetup(true)} style={{ padding: '10px 24px', borderRadius: '10px', backgroundColor: '#2563eb', color: 'white', fontSize: '0.8rem', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Add first member</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {filtered.map((member, i) => {
            const name = typeof member === 'object' ? member.name : member;
            const avatar = getAvatar(name);
            const email = typeof member === 'object' ? member.email : '';
            const linkedin = typeof member === 'object' ? member.linkedin : '';
            const isOnline = name === currentReporter;
            const storedRole = getRoleForProfile ? getRoleForProfile(name) : null;
            const role = (storedRole && storedRole !== 'Team Member') ? storedRole : (typeof member === 'object' && member.role ? member.role : (storedRole || 'Team Member'));
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];

            return (
              <div key={`${name}-${i}`} style={{
                backgroundColor: 'var(--color-bg-surface)', borderRadius: '16px',
                border: '1px solid var(--color-border)', padding: '28px 20px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', transition: 'all 0.2s', position: 'relative',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  backgroundColor: color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', fontWeight: '800', overflow: 'hidden',
                  marginBottom: '16px', position: 'relative',
                  boxShadow: `0 4px 12px ${color}30`,
                }}>
                  {avatar && <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />}
                  {getInitials(name)}
                </div>

                {/* Name */}
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '2px' }}>
                  {capitalizeName(name)}
                </div>

                {/* Email */}
                {email && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {email}
                  </div>
                )}

                {/* Role badge */}
                <div style={{
                  fontSize: '0.65rem', fontWeight: '600', color: '#2563eb',
                  padding: '4px 12px', borderRadius: '99px',
                  backgroundColor: 'color-mix(in srgb, #2563eb 8%, var(--color-bg-surface))',
                  marginBottom: '14px',
                }}>
                  {role}
                </div>

                {/* Action row */}
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  {email && (
                    <a href={`mailto:${email}`} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      padding: '8px', borderRadius: '10px',
                      backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)',
                      fontSize: '0.7rem', fontWeight: '600', color: 'var(--color-text-muted)',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}>
                      <Mail size={12} /> Email
                    </a>
                  )}
                  {linkedin && (
                    <a href={linkedin} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      padding: '8px', borderRadius: '10px',
                      backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)',
                      fontSize: '0.7rem', fontWeight: '600', color: '#0a66c2',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a66c2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      LinkedIn
                    </a>
                  )}
                  {!email && !linkedin && (
                    <div style={{
                      flex: 1, padding: '8px', borderRadius: '10px',
                      backgroundColor: 'var(--color-bg-body)',
                      fontSize: '0.65rem', color: 'var(--color-text-light)', textAlign: 'center',
                    }}>
                      No links added
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showSetup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowSetup(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 'min(420px, 90%)', backgroundColor: 'var(--color-bg-surface)',
            borderRadius: '24px', padding: '36px 32px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '4px' }}>Add Team Member</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '24px' }}>Set the display name and role</p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
              <input value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="Enter name" spellCheck={false}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
              <select value={setupRole} onChange={(e) => setSetupRole(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none', cursor: 'pointer' }}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSetup(false)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSetup} disabled={saving || !setupName.trim()} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', opacity: saving || !setupName.trim() ? 0.5 : 1 }}>{saving ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
