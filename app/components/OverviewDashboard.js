"use client";
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Inbox, Activity, CheckCircle2, ArrowRight
} from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

const IN_FLIGHT_STATUSES = ['In Progress', 'In PR', 'In Testing', 'Code Review', 'Review', 'In Review', 'UAT', 'Ready for Deploy', 'Ready to Deploy'];
const OPEN_STATUSES = ['Open', 'ReOpen'];
const CLOSED_STATUSES = ['Closed', 'Resolved'];

function toName(v) {
  if (typeof v === 'object' && v !== null) return v.name || '';
  if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
  return v || '';
}

function shortId(id) {
  const tail = String(id || '').split('-')[1] || '';
  return `BUG-${tail.substring(0, 4).toUpperCase()}`;
}

function relativeDate(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return Math.floor(diff / 86_400_000) + 'd ago';
}

function priorityTint(p) {
  const v = String(p || '').toLowerCase();
  if (v === 'critical') return '#dc2626';
  if (v === 'high') return '#ea580c';
  if (v === 'medium') return '#f59e0b';
  if (v === 'low') return '#22c55e';
  return '#64748b';
}

const SECTION_META = {
  'Critical':   { color: '#dc2626', icon: AlertTriangle, hint: 'Critical priority bugs that need immediate attention.' },
  'Unassigned': { color: '#3b82f6', icon: Inbox,         hint: 'Bugs with no owner yet — pick someone to triage.' },
  'In Flight':  { color: '#f59e0b', icon: Activity,      hint: 'Active work moving through dev, PR, or QA.' }
};

export default function OverviewDashboard({ bugs, onOpenBug }) {
  const groups = useMemo(() => {
    const critical = [];
    const unassigned = [];
    const inFlight = [];

    bugs.forEach(b => {
      if (CLOSED_STATUSES.includes(b.status)) return;
      const isCritical = String(b.priority || '').toLowerCase() === 'critical';
      const assignee = toName(b.assignee);
      const unassignedFlag = !assignee || ['Not Assigned', 'Unassigned'].includes(assignee);

      if (isCritical) {
        critical.push(b);
      } else if (IN_FLIGHT_STATUSES.includes(b.status)) {
        inFlight.push(b);
      } else if (OPEN_STATUSES.includes(b.status) && unassignedFlag) {
        unassigned.push(b);
      } else if (OPEN_STATUSES.includes(b.status)) {
        inFlight.push(b);
      }
    });

    const sortByUpdated = (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    return {
      'Critical':   critical.sort(sortByUpdated),
      'Unassigned': unassigned.sort(sortByUpdated),
      'In Flight':  inFlight.sort(sortByUpdated)
    };
  }, [bugs]);

  const closedThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    return bugs.filter(b => CLOSED_STATUSES.includes(b.status) && new Date(b.updatedAt || 0).getTime() > cutoff).length;
  }, [bugs]);

  const sections = [
    { key: 'Critical',   list: groups['Critical'] },
    { key: 'Unassigned', list: groups['Unassigned'] },
    { key: 'In Flight',  list: groups['In Flight'] }
  ];

  const totalOpen = sections.reduce((n, s) => n + s.list.length, 0);

  if (totalOpen === 0 && closedThisWeek === 0) {
    return <OverviewEmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>
          {totalOpen === 0
            ? 'No open bugs across the pipeline.'
            : `${totalOpen} open ${totalOpen === 1 ? 'bug' : 'bugs'} across the pipeline.`}
        </span>
        {closedThisWeek > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#22c55e' }}>
            <CheckCircle2 size={13} /> {closedThisWeek} closed this week
          </span>
        )}
      </div>

      {sections.map(({ key, list }) => {
        const meta = SECTION_META[key];
        const Icon = meta.icon;
        if (list.length === 0) return null;
        return (
          <section key={key} style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Icon size={15} color={meta.color} strokeWidth={2} />
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>{key}</div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 600,
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--chrome-bg-subtle)',
                padding: '1px 9px', borderRadius: 999
              }}>{list.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--chrome-border)' }}>
              {list.map(bug => (
                <BugRow key={bug.id} bug={bug} accent={meta.color} onOpenBug={onOpenBug} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BugRow({ bug, accent, onOpenBug }) {
  const assignee = toName(bug.assignee);
  const reporter = toName(bug.reporter);
  const router = useRouter();
  const openBug = () => onOpenBug ? onOpenBug(bug) : router.push(`/bugs?bug=${bug.id}`);
  const owner = assignee && !['Not Assigned', 'Unassigned'].includes(assignee) ? assignee : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openBug}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBug(); } }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 72px 1fr auto',
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
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: accent }} />

      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {shortId(bug.id)}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-main)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>{bug.title}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span>{owner ? owner : (reporter ? `reported by ${reporter}` : 'unassigned')}</span>
          <span>·</span>
          <span>{bug.status}</span>
          <span>·</span>
          <span>{relativeDate(bug.updatedAt || bug.createdAt)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {bug.priority && (
          <span style={{
            fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            backgroundColor: priorityTint(bug.priority) + '18',
            color: priorityTint(bug.priority),
            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
          }}>{bug.priority}</span>
        )}
        <ArrowRight size={14} color="var(--color-text-muted)" />
      </div>
    </div>
  );
}

function OverviewEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px 40px', gap: 18, color: 'var(--color-text-muted)'
    }}>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="138" rx="62" ry="4" fill="currentColor" opacity="0.08" />
        <rect x="30" y="36" width="140" height="84" rx="10" fill="currentColor" opacity="0.06" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
        <rect x="30" y="36" width="140" height="18" rx="10" fill="currentColor" opacity="0.12" />
        <circle cx="42" cy="45" r="2" fill="currentColor" opacity="0.4" />
        <circle cx="50" cy="45" r="2" fill="currentColor" opacity="0.4" />
        <circle cx="58" cy="45" r="2" fill="currentColor" opacity="0.4" />
        <rect x="44" y="68" width="20" height="30" rx="3" fill="#22c55e" opacity="0.3" />
        <rect x="44" y="78" width="20" height="20" rx="3" fill="#22c55e" />
        <rect x="72" y="62" width="20" height="36" rx="3" fill="#3b82f6" opacity="0.3" />
        <rect x="72" y="76" width="20" height="22" rx="3" fill="#3b82f6" />
        <rect x="100" y="74" width="20" height="24" rx="3" fill="#f59e0b" opacity="0.3" />
        <rect x="100" y="86" width="20" height="12" rx="3" fill="#f59e0b" />
        <rect x="128" y="58" width="20" height="40" rx="3" fill="#8b5cf6" opacity="0.3" />
        <rect x="128" y="72" width="20" height="26" rx="3" fill="#8b5cf6" />
        <path d="M44 108 L156 108" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 380 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
          Pipeline&rsquo;s quiet.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Nothing open, nothing closing this week. When bugs come in, they&rsquo;ll show up here organised by priority.
        </div>
      </div>
    </div>
  );
}
