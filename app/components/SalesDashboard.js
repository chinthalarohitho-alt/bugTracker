"use client";
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon, Clock, Trophy, Package, ArrowRight
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;

const CLOSED_STATUSES = ['Closed', 'Resolved'];
const HIGH_IMPACT_PRIORITIES = ['critical', 'high'];

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

function ageInDays(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

function priorityTint(p) {
  const v = String(p || '').toLowerCase();
  if (v === 'critical') return '#dc2626';
  if (v === 'high') return '#ea580c';
  if (v === 'medium') return '#f59e0b';
  if (v === 'low') return '#22c55e';
  return '#64748b';
}

export default function SalesDashboard({ bugs, onOpenBug }) {
  const highImpact = useMemo(
    () => bugs
      .filter(b => !CLOSED_STATUSES.includes(b.status))
      .filter(b => HIGH_IMPACT_PRIORITIES.includes(String(b.priority || '').toLowerCase()))
      .sort((a, b) => {
        const pa = String(a.priority || '').toLowerCase() === 'critical' ? 0 : 1;
        const pb = String(b.priority || '').toLowerCase() === 'critical' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      }),
    [bugs]
  );

  const stale = useMemo(
    () => bugs
      .filter(b => !CLOSED_STATUSES.includes(b.status))
      .filter(b => ageInDays(b.createdAt) >= STALE_DAYS)
      .filter(b => !HIGH_IMPACT_PRIORITIES.includes(String(b.priority || '').toLowerCase()))
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
    [bugs]
  );

  const recentWins = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    return bugs
      .filter(b => CLOSED_STATUSES.includes(b.status))
      .filter(b => new Date(b.updatedAt || 0).getTime() > cutoff)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [bugs]);

  const byProject = useMemo(() => {
    const map = new Map();
    bugs.forEach(b => {
      if (CLOSED_STATUSES.includes(b.status)) return;
      const project = b.project || 'Unspecified';
      const entry = map.get(project) || { project, total: 0, critical: 0, high: 0 };
      entry.total += 1;
      const p = String(b.priority || '').toLowerCase();
      if (p === 'critical') entry.critical += 1;
      if (p === 'high') entry.high += 1;
      map.set(project, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [bugs]);

  const totalOpen = bugs.filter(b => !CLOSED_STATUSES.includes(b.status)).length;
  const closedThisWeek = recentWins.length;

  if (totalOpen === 0 && closedThisWeek === 0) {
    return <SalesEmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>
          {`${highImpact.length} high-impact · ${stale.length} stale · ${closedThisWeek} shipped this week.`}
        </span>
      </div>

      {highImpact.length > 0 && (
        <CollapsibleSection
          icon={AlertOctagon} color="#dc2626" label="Customer Impact"
          hint="Critical & high-priority bugs customers will feel."
          items={highImpact}
          renderItem={bug => <BugRow key={bug.id} bug={bug} accent="#dc2626" mode="impact" onOpenBug={onOpenBug} />}
          marginTop={20}
        />
      )}

      {stale.length > 0 && (
        <CollapsibleSection
          icon={Clock} color="#f59e0b" label="Stale"
          hint={`Open for ${STALE_DAYS}+ days — customers are waiting.`}
          items={stale}
          renderItem={bug => <BugRow key={bug.id} bug={bug} accent="#f59e0b" mode="stale" onOpenBug={onOpenBug} />}
          marginTop={28}
        />
      )}

      {recentWins.length > 0 && (
        <CollapsibleSection
          icon={Trophy} color="#22c55e" label="Recent Wins"
          hint="Share these with customers this week."
          items={recentWins}
          renderItem={bug => <BugRow key={bug.id} bug={bug} accent="#22c55e" mode="win" onOpenBug={onOpenBug} />}
          marginTop={28}
        />
      )}

      {byProject.length > 0 && (
        <CollapsibleSection
          icon={Package} color="#0ea5e9" label="By Project"
          hint="Open bug load per product."
          items={byProject}
          renderItem={p => <ProjectRow key={p.project} entry={p} max={byProject[0].total} />}
          marginTop={28}
        />
      )}
    </div>
  );
}


function BugRow({ bug, accent, mode, onOpenBug }) {
  const router = useRouter();
  const openBug = () => onOpenBug ? onOpenBug(bug) : router.push(`/bugs?bug=${bug.id}`);
  const assignee = toName(bug.assignee);
  const project = bug.project && bug.project !== 'General' ? bug.project : null;
  const days = ageInDays(bug.createdAt);

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
          {project && <><span>{project}</span><span>·</span></>}
          {mode === 'win'
            ? <span>Closed {relativeDate(bug.updatedAt)}</span>
            : mode === 'stale'
              ? <span style={{ color: '#ea580c', fontWeight: 500 }}>{days}d old</span>
              : <span>{bug.status}</span>
          }
          {assignee && <><span>·</span><span>{assignee}</span></>}
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

function ProjectRow({ entry, max }) {
  const router = useRouter();
  const widthPct = Math.max(4, Math.round((entry.total / max) * 100));
  const hasHeat = entry.critical > 0 || entry.high > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/bugs?project=${encodeURIComponent(entry.project)}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/bugs?project=${encodeURIComponent(entry.project)}`); } }}
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
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: hasHeat ? '#dc2626' : '#0ea5e9' }} />

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-main)' }}>{entry.project}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <div style={{
            flex: 1, height: 4, borderRadius: 999,
            backgroundColor: 'var(--chrome-bg-subtle)',
            overflow: 'hidden', maxWidth: 220
          }}>
            <div style={{
              width: `${widthPct}%`, height: '100%',
              backgroundColor: hasHeat ? '#dc2626' : '#0ea5e9',
              opacity: 0.85
            }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {entry.total} open
          </span>
        </div>
      </div>

      {hasHeat && (
        <span style={{
          fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
          backgroundColor: '#dc262618', color: '#dc2626',
          textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
        }}>{entry.critical + entry.high} urgent</span>
      )}

      <ArrowRight size={14} color="var(--color-text-muted)" />
    </div>
  );
}

function SalesEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px 40px', gap: 18, color: 'var(--color-text-muted)'
    }}>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="138" rx="58" ry="4" fill="currentColor" opacity="0.08" />
        <rect x="40" y="40" width="120" height="80" rx="10" fill="currentColor" opacity="0.06" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
        <path d="M50 100 L70 82 L90 92 L110 68 L130 78 L150 58" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="100" r="3.5" fill="#22c55e" />
        <circle cx="70" cy="82" r="3.5" fill="#22c55e" />
        <circle cx="90" cy="92" r="3.5" fill="#22c55e" />
        <circle cx="110" cy="68" r="3.5" fill="#22c55e" />
        <circle cx="130" cy="78" r="3.5" fill="#22c55e" />
        <circle cx="150" cy="58" r="5" fill="#22c55e" />
        <path d="M146 58 l3 3 l6 -6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="50" y="110" width="100" height="2" rx="1" fill="currentColor" opacity="0.2" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 380 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
          All clear for customers.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          No high-impact or stale bugs right now. When issues come in, you&rsquo;ll see customer impact, aging bugs, and this week&rsquo;s wins here.
        </div>
      </div>
    </div>
  );
}
