"use client";
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Briefcase, AlertCircle, ArrowRight, Mail
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import CollapsibleSection from './CollapsibleSection';

const CLOSED_STATUSES = ['Closed', 'Resolved'];

function toName(v) {
  if (typeof v === 'object' && v !== null) return v.name || '';
  if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
  return v || '';
}

function initials(name) {
  return (name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

function roleTint(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('qa')) return '#8b5cf6';
  if (r.includes('dev') || r.includes('tech') || r.includes('ops')) return '#0ea5e9';
  if (r.includes('founder')) return '#f97316';
  if (r.includes('design')) return '#ec4899';
  if (r.includes('manager') || r.includes('lead')) return '#22c55e';
  if (r.includes('hr')) return '#eab308';
  if (r.includes('sales')) return '#06b6d4';
  return '#64748b';
}

export default function HRDashboard({ bugs }) {
  const { globalSettings } = useAuth();
  const router = useRouter();

  const members = useMemo(
    () => (globalSettings?.assignees || [])
      .filter(a => typeof a === 'object' && a.name && !['Not Assigned', 'Unassigned'].includes(a.name)),
    [globalSettings]
  );

  const workloadByName = useMemo(() => {
    const map = new Map();
    bugs.forEach(b => {
      if (CLOSED_STATUSES.includes(b.status)) return;
      const owner = toName(b.assignee);
      if (!owner || ['Not Assigned', 'Unassigned'].includes(owner)) return;
      map.set(owner, (map.get(owner) || 0) + 1);
    });
    return map;
  }, [bugs]);

  const roleBreakdown = useMemo(() => {
    const buckets = new Map();
    members.forEach(m => {
      const role = m.role || 'Unassigned Role';
      const list = buckets.get(role) || [];
      list.push(m);
      buckets.set(role, list);
    });
    return Array.from(buckets.entries())
      .map(([role, list]) => ({ role, count: list.length, members: list }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  const overloaded = useMemo(() => {
    return members
      .map(m => ({ member: m, count: workloadByName.get(m.name) || 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [members, workloadByName]);

  const profileGaps = useMemo(() => {
    return members.filter(m => !m.email || !m.role).map(m => ({
      member: m,
      missing: [!m.email && 'email', !m.role && 'role'].filter(Boolean)
    }));
  }, [members]);

  const unassignedBugs = useMemo(
    () => bugs.filter(b => !CLOSED_STATUSES.includes(b.status)).filter(b => {
      const owner = toName(b.assignee);
      return !owner || ['Not Assigned', 'Unassigned'].includes(owner);
    }).length,
    [bugs]
  );

  if (members.length === 0) {
    return <HREmptyState />;
  }

  const totalRoles = roleBreakdown.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>
          {`${members.length} ${members.length === 1 ? 'teammate' : 'teammates'} across ${totalRoles} ${totalRoles === 1 ? 'role' : 'roles'}.`}
        </span>
        {unassignedBugs > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#ea580c' }}>
            <AlertCircle size={13} /> {unassignedBugs} unassigned {unassignedBugs === 1 ? 'bug' : 'bugs'}
          </span>
        )}
      </div>

      <CollapsibleSection
        icon={Briefcase} color="#0ea5e9" label="Team Composition"
        items={roleBreakdown}
        renderItem={({ role, count, members: list }) => (
          <RoleRow key={role} role={role} count={count} members={list} total={members.length} />
        )}
      />

      {overloaded.length > 0 && (
        <CollapsibleSection
          icon={Users} color="#f59e0b" label="Workload"
          hint="Members with open bugs assigned."
          items={overloaded}
          marginTop={28}
          renderItem={({ member, count }) => (
            <MemberRow
              key={member.name}
              member={member}
              rightLabel={`${count} open`}
              rightTone="#f59e0b"
              onClick={() => router.push(`/bugs?assignee=${encodeURIComponent(member.name)}`)}
            />
          )}
        />
      )}

      {profileGaps.length > 0 && (
        <CollapsibleSection
          icon={UserPlus} color="#dc2626" label="Profile Gaps"
          hint="Members missing email or role — complete their profile."
          items={profileGaps}
          marginTop={28}
          renderItem={({ member, missing }) => (
            <MemberRow
              key={member.name}
              member={member}
              rightLabel={`missing ${missing.join(' + ')}`}
              rightTone="#dc2626"
              onClick={() => router.push('/team')}
            />
          )}
        />
      )}
    </div>
  );
}

function RoleRow({ role, count, members, total }) {
  const tint = roleTint(role);
  const percent = Math.round((count / total) * 100);
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push('/team')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/team'); } }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        alignItems: 'center',
        gap: 14,
        padding: '12px 8px',
        borderBottom: '1px solid var(--chrome-border)',
        cursor: 'pointer',
        transition: 'background-color 0.12s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-bg-subtle)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tint }} />

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-main)' }}>{role}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
          {count} {count === 1 ? 'member' : 'members'} · {percent}% of team
        </div>
      </div>

      <div style={{ display: 'flex', marginRight: 8 }}>
        {members.slice(0, 4).map((m, i) => (
          <Avatar key={m.name} member={m} offset={i} />
        ))}
        {members.length > 4 && (
          <span style={{
            width: 26, height: 26, borderRadius: '50%',
            marginLeft: -8,
            backgroundColor: 'var(--chrome-bg-subtle)',
            border: '2px solid var(--color-bg-body)',
            color: 'var(--color-text-muted)',
            fontSize: '0.65rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1
          }}>+{members.length - 4}</span>
        )}
      </div>

      <ArrowRight size={14} color="var(--color-text-muted)" />
    </div>
  );
}

function MemberRow({ member, rightLabel, rightTone, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        alignItems: 'center',
        gap: 14,
        padding: '12px 8px',
        borderBottom: '1px solid var(--chrome-border)',
        cursor: 'pointer',
        transition: 'background-color 0.12s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-bg-subtle)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <Avatar member={member} />

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-main)' }}>{member.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{member.role || 'No role'}</span>
          {member.email && <>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Mail size={11} /> {member.email}
            </span>
          </>}
        </div>
      </div>

      <span style={{
        fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
        backgroundColor: rightTone + '18',
        color: rightTone,
        textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
      }}>{rightLabel}</span>

      <ArrowRight size={14} color="var(--color-text-muted)" />
    </div>
  );
}

function Avatar({ member, offset = 0 }) {
  const bg = member.color || '#2563eb';
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      backgroundColor: bg, color: 'white',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.65rem', fontWeight: 600,
      marginLeft: offset > 0 ? -8 : 0,
      border: '2px solid var(--color-bg-body)',
      overflow: 'hidden', flexShrink: 0,
      zIndex: 10 - offset
    }}>
      {member.avatar
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={member.avatar} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(member.name)}
    </div>
  );
}

function HREmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px 40px', gap: 18, color: 'var(--color-text-muted)'
    }}>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="138" rx="58" ry="4" fill="currentColor" opacity="0.08" />
        <circle cx="70" cy="70" r="22" fill="currentColor" opacity="0.1" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="100" cy="62" r="22" fill="currentColor" opacity="0.1" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="130" cy="70" r="22" fill="currentColor" opacity="0.1" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="100" cy="62" r="14" fill="#8b5cf6" />
        <circle cx="100" cy="58" r="4" fill="white" />
        <path d="M94 70 Q100 74 106 70 L106 74 L94 74 Z" fill="white" />
        <circle cx="160" cy="100" r="10" fill="#22c55e" />
        <path d="M160 96 L160 104 M156 100 L164 100" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 380 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
          No teammates yet.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Head to the Team page to add your first member. Once people are here, you&rsquo;ll see headcount, workload, and profile gaps at a glance.
        </div>
      </div>
    </div>
  );
}
