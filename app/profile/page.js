"use client";
import { useState, useEffect } from 'react';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import { useSession } from 'next-auth/react';
import { Save, Link2, Mail, User, Shield, Briefcase } from 'lucide-react';
import GlobalHeader from '../components/GlobalHeader';

const ROLE_OPTIONS = [
  'Founder', 'HR Admin', 'Sales Manager',
  'Developer', 'QA Engineer', 'Product Manager', 'Project Manager',
  'Designer', 'DevOps', 'Tech Lead', 'Engineering Manager',
];

export default function ProfilePage() {
  const { currentReporter, getAvatar, getInitials, getRoleForProfile, setRoleForProfile, globalSettings, setGlobalSettings } = useAuth();
  const { data: session } = useSession();

  const [name, setName] = useState(currentReporter || '');
  const [role, setRole] = useState('');
  const [avatar, setAvatar] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');

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
    if (!name.trim()) return;
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

      // If name changed, update all bugs where this user is assignee or reporter
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
  };

  if (!currentReporter || !globalSettings) return (
    <main style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}><GlobalHeader /></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading profile...</div>
    </main>
  );

  const email = session?.user?.email || '';
  const initials = getInitials(name || currentReporter);

  return (
    <main style={{ padding: '20px 20px 80px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <GlobalHeader />
      </div>

      {/* Profile Header */}
      <div style={{
        backgroundColor: 'var(--color-bg-surface)', borderRadius: '24px',
        border: '1px solid var(--color-border)', padding: '32px 36px',
        marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '24px',
      }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            backgroundColor: '#2563eb', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: '800', overflow: 'hidden',
            position: 'relative',
          }}>
            {avatar && <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />}
            {initials}
          </div>
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.03em' }}>
            {capitalizeName(name || currentReporter)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <Briefcase size={12} /> {role}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <Mail size={12} /> {email}
            </span>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 24px', borderRadius: '12px', border: 'none',
            backgroundColor: saved ? '#10b981' : '#2563eb', color: 'white',
            fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
            boxShadow: saved ? '0 4px 14px rgba(16,185,129,0.3)' : '0 4px 14px rgba(37,99,235,0.25)',
            transition: 'all 0.3s', flexShrink: 0,
          }}
        >
          <Save size={15} />
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px', backgroundColor: 'var(--color-bg-surface)', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
        {[
          { id: 'personal', label: 'Personal Info', icon: User },
          { id: 'role', label: 'Role', icon: Shield },
          { id: 'social', label: 'Social Links', icon: Link2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '10px', border: 'none',
              backgroundColor: activeTab === tab.id ? '#2563eb' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--color-text-muted)',
              fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        backgroundColor: 'var(--color-bg-surface)', borderRadius: '20px',
        border: '1px solid var(--color-border)', padding: '32px',
      }}>

        {activeTab === 'personal' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Personal Information</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '28px' }}>Manage your display name, email, and profile photo</p>

            {/* Avatar URL */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Photo URL</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: '#2563eb', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: '800', overflow: 'hidden', position: 'relative',
                }}>
                  {avatar && <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />}
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder={session?.user?.image ? 'Using Google profile photo' : 'Paste image URL...'}
                    spellCheck={false}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '12px',
                      border: '1.5px solid var(--color-border)', fontSize: '0.85rem',
                      backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                    onBlur={(e) => e.target.style.borderColor = ''}
                  />
                </div>
                {avatar && avatar !== session?.user?.image && (
                  <button
                    onClick={() => setAvatar(session?.user?.image || '')}
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-body)', fontSize: '0.72rem', fontWeight: '600',
                      color: 'var(--color-text-muted)', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Reset to Google
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px',
                    border: '1.5px solid var(--color-border)', fontSize: '0.9rem',
                    backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = ''}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                <div style={{
                  padding: '12px 14px', borderRadius: '12px',
                  backgroundColor: 'var(--color-bg-body)', border: '1.5px solid var(--color-border)',
                  fontSize: '0.9rem', color: 'var(--color-text-light)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Mail size={14} color="var(--color-text-light)" />
                  {email}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'role' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Role & Position</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '28px' }}>Select your role in the organization</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {ROLE_OPTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    padding: '14px 16px', borderRadius: '14px',
                    border: role === r ? '2px solid #2563eb' : '1.5px solid var(--color-border)',
                    backgroundColor: role === r ? 'color-mix(in srgb, #2563eb 8%, var(--color-bg-surface))' : 'var(--color-bg-body)',
                    color: role === r ? '#2563eb' : 'var(--color-text-main)',
                    fontSize: '0.82rem', fontWeight: role === r ? '700' : '500',
                    cursor: 'pointer', transition: 'all 0.15s',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: role === r ? '6px solid #2563eb' : '2px solid var(--color-border)',
                    backgroundColor: role === r ? 'white' : 'transparent',
                    flexShrink: 0, transition: 'all 0.15s',
                  }} />
                  {r}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === 'social' && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Social Links</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '28px' }}>Connect your professional profiles</p>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LinkedIn</label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  width: '28px', height: '28px', borderRadius: '8px',
                  backgroundColor: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </div>
                <input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                  spellCheck={false}
                  style={{
                    width: '100%', padding: '12px 14px 12px 52px', borderRadius: '12px',
                    border: '1.5px solid var(--color-border)', fontSize: '0.9rem',
                    backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0a66c2'}
                  onBlur={(e) => e.target.style.borderColor = ''}
                />
              </div>
              {linkedin && (
                <a href={linkedin} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  marginTop: '12px', fontSize: '0.75rem', color: '#0a66c2', fontWeight: '600', textDecoration: 'none',
                }}>
                  View profile →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
