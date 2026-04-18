"use client";
import { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette, Paintbrush, Sparkles, CheckCircle2, ArrowRight
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

const DAY_MS = 24 * 60 * 60 * 1000;
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

function isDesignBug(bug) {
  const haystack = [bug.module, bug.title, bug.description]
    .map(v => String(v || ''))
    .join(' ');
  return /ui\/ux/i.test(haystack);
}

export default function DesignerDashboard({ bugs, currentReporter, onUpdateBug, onOpenBug }) {
  const [busyId, setBusyId] = useState(null);

  const mine = useMemo(
    () => bugs.filter(b => toName(b.assignee) === currentReporter && !CLOSED_STATUSES.includes(b.status)),
    [bugs, currentReporter]
  );

  const uiBugs = useMemo(
    () => bugs
      .filter(b => !CLOSED_STATUSES.includes(b.status))
      .filter(b => isDesignBug(b))
      .filter(b => toName(b.assignee) !== currentReporter)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
    [bugs, currentReporter]
  );

  const recentWins = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    return bugs
      .filter(b => CLOSED_STATUSES.includes(b.status))
      .filter(b => isDesignBug(b))
      .filter(b => new Date(b.updatedAt || 0).getTime() > cutoff)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [bugs]);

  const handleReview = useCallback(async (bug) => {
    if (busyId) return;
    setBusyId(bug.id);
    try {
      await onUpdateBug({ ...bug, status: 'In Progress', updatedBy: currentReporter });
    } finally {
      setBusyId(null);
    }
  }, [busyId, onUpdateBug, currentReporter]);

  const totalOpen = mine.length + uiBugs.length;

  if (totalOpen === 0 && recentWins.length === 0) {
    return <DesignerEmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>
          {totalOpen === 0
            ? 'No design bugs open — nice.'
            : `${mine.length} on your plate · ${uiBugs.length} UI/UX open across the pipeline.`}
        </span>
        {recentWins.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#22c55e' }}>
            <CheckCircle2 size={13} /> {recentWins.length} polished this week
          </span>
        )}
      </div>

      {mine.length > 0 && (
        <CollapsibleSection
          icon={Paintbrush}
          color="#ec4899"
          label="My Queue"
          hint="Assigned to you."
          items={mine}
          renderItem={(bug) => (
            <BugRow
              key={bug.id}
              bug={bug}
              accent="#ec4899"
              busy={busyId === bug.id}
              action={bug.status === 'Open' || bug.status === 'ReOpen'
                ? { label: 'Start designing', tone: '#ec4899' }
                : null}
              onAct={() => handleReview(bug)}
              onOpenBug={onOpenBug}
            />
          )}
        />
      )}

      {uiBugs.length > 0 && (
        <CollapsibleSection
          icon={Palette}
          color="#8b5cf6"
          label="UI/UX Issues"
          hint="Design-related bugs across the pipeline."
          items={uiBugs}
          marginTop={28}
          renderItem={(bug) => (
            <BugRow key={bug.id} bug={bug} accent="#8b5cf6" showAssignee onOpenBug={onOpenBug} />
          )}
        />
      )}

      {recentWins.length > 0 && (
        <CollapsibleSection
          icon={Sparkles}
          color="#22c55e"
          label="Recent Polish"
          hint="Design bugs shipped this week."
          items={recentWins}
          marginTop={28}
          renderItem={(bug) => (
            <BugRow key={bug.id} bug={bug} accent="#22c55e" mode="win" onOpenBug={onOpenBug} />
          )}
        />
      )}
    </div>
  );
}

function BugRow({ bug, accent, showAssignee, mode, action, busy, onAct, onOpenBug }) {
  const router = useRouter();
  const openBug = () => onOpenBug ? onOpenBug(bug) : router.push(`/bugs?bug=${bug.id}`);
  const assignee = toName(bug.assignee);
  const project = bug.project && bug.project !== 'General' ? bug.project : null;

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
            : <span>{bug.status}</span>}
          {showAssignee && assignee && <><span>·</span><span>{assignee}</span></>}
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
        {action && (
          <button
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onAct?.(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: 'none', cursor: busy ? 'wait' : 'pointer',
              backgroundColor: action.tone, color: 'white',
              fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap',
              opacity: busy ? 0.6 : 1
            }}>
            {busy ? '…' : action.label} <ArrowRight size={12} />
          </button>
        )}
        {!action && <ArrowRight size={14} color="var(--color-text-muted)" />}
      </div>
    </div>
  );
}

function DesignerEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px 40px', gap: 18, color: 'var(--color-text-muted)'
    }}>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="138" rx="58" ry="4" fill="currentColor" opacity="0.08" />
        <path d="M100 40 C70 40 46 64 46 90 C46 104 54 114 66 114 C72 114 76 110 76 104 C76 100 74 98 74 94 C74 90 78 86 84 86 L100 86 C128 86 150 66 150 40 C150 38 146 34 140 34 C118 34 100 40 100 40 Z" fill="currentColor" opacity="0.08" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
        <circle cx="68" cy="84" r="5" fill="#ec4899" />
        <circle cx="60" cy="68" r="5" fill="#8b5cf6" />
        <circle cx="72" cy="56" r="5" fill="#f59e0b" />
        <circle cx="92" cy="52" r="5" fill="#22c55e" />
        <circle cx="112" cy="52" r="5" fill="#06b6d4" />
        <circle cx="130" cy="60" r="5" fill="#3b82f6" />
        <rect x="136" y="90" width="18" height="6" rx="3" fill="#f43f5e" />
        <rect x="134" y="95" width="4" height="26" rx="2" fill="#9f1239" />
        <path d="M134 120 L138 128 L142 120 Z" fill="#9f1239" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 380 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
          Canvas is clear.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          No design bugs open right now. When UI/UX issues come in, you&rsquo;ll see them here — plus your queue and recent polish.
        </div>
      </div>
    </div>
  );
}
