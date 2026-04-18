"use client";
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Code2, GitPullRequest, Rocket, ArrowRight,
  ExternalLink, AlertTriangle, X
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

const STATUS_META = {
  'To Fix': {
    matchers: ['Open', 'ReOpen'],
    color: '#3b82f6', icon: AlertTriangle,
    hint: 'Assigned to you. Start when ready.',
    cta: { label: 'Start Working', next: 'In Progress', tone: '#3b82f6' }
  },
  'In Progress': {
    matchers: ['In Progress'],
    color: '#f59e0b', icon: Code2,
    hint: 'Keep going — raise a PR when fix is ready.',
    cta: { label: 'Raise PR', next: 'In PR', tone: '#8b5cf6', requiresPR: true }
  },
  'Deploy to Dev': {
    matchers: ['In PR', 'Code Review', 'Review', 'In Review', 'Ready for Deploy', 'Ready to Deploy'],
    color: '#22c55e', icon: Rocket,
    hint: 'QA is reviewing the PR. Push to dev env when merged.',
    cta: { label: 'Mark Deployed', next: 'In Testing', tone: '#22c55e' }
  }
};

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

const lastPr = (b) => {
  const v = b?.githubPr;
  if (Array.isArray(v)) return v[v.length - 1] || null;
  return v || null;
};

export default function DevDashboard({ bugs, currentReporter, onUpdateBug, onOpenBug }) {
  const [busyId, setBusyId] = useState(null);
  const [prModalBug, setPrModalBug] = useState(null);
  const [prUrl, setPrUrl] = useState('');

  const mine = useMemo(
    () => bugs.filter(b => toName(b.assignee) === currentReporter),
    [bugs, currentReporter]
  );

  const columns = useMemo(() => {
    const out = {};
    Object.entries(STATUS_META).forEach(([key, meta]) => {
      out[key] = mine.filter(b => meta.matchers.includes(b.status));
    });
    return out;
  }, [mine]);

  const handleAdvance = useCallback(async (bug, nextStatus, extra = {}) => {
    if (busyId) return;
    setBusyId(bug.id);
    try {
      await onUpdateBug({ ...bug, status: nextStatus, updatedBy: currentReporter, ...extra });
    } finally {
      setBusyId(null);
    }
  }, [busyId, onUpdateBug, currentReporter]);

  const submitPR = async () => {
    if (!prModalBug || !prUrl.trim()) return;
    const existing = Array.isArray(prModalBug.githubPr) ? prModalBug.githubPr : [];
    await handleAdvance(prModalBug, 'In PR', { githubPr: [...existing, prUrl.trim()] });
    setPrModalBug(null);
    setPrUrl('');
  };

  const sections = [
    { key: 'Deploy to Dev', list: columns['Deploy to Dev'] || [] },
    { key: 'In Progress',   list: columns['In Progress']   || [] },
    { key: 'To Fix',        list: columns['To Fix']        || [] },
  ];

  const totalOpen = sections.reduce((n, s) => n + s.list.length, 0);

  if (totalOpen === 0) {
    return <DevEmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
        {`${totalOpen} open ${totalOpen === 1 ? 'bug' : 'bugs'} assigned to you.`}
      </div>

      {sections.map(({ key, list }) => {
        const meta = STATUS_META[key];
        if (list.length === 0) return null;
        return (
          <CollapsibleSection
            key={key}
            icon={meta.icon}
            color={meta.color}
            label={key}
            items={list}
            renderItem={(bug) => {
              const prLink = lastPr(bug);
              return (
                <BugRow
                  key={bug.id}
                  bug={bug}
                  accent={meta.color}
                  prLink={prLink}
                  cta={meta.cta}
                  busy={busyId === bug.id}
                  onOpenBug={onOpenBug}
                  onAct={() => {
                    if (!meta.cta) return;
                    if (meta.cta.requiresPR) {
                      setPrModalBug(bug);
                      setPrUrl(prLink || '');
                    } else {
                      handleAdvance(bug, meta.cta.next);
                    }
                  }}
                />
              );
            }}
          />
        );
      })}

      {prModalBug && (
        <PRModal
          bug={prModalBug}
          value={prUrl}
          onChange={setPrUrl}
          onCancel={() => { setPrModalBug(null); setPrUrl(''); }}
          onSubmit={submitPR}
          busy={busyId === prModalBug.id}
        />
      )}
    </div>
  );
}

function DevEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px 40px', gap: 18, color: 'var(--color-text-muted)'
    }}>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="138" rx="62" ry="4" fill="currentColor" opacity="0.08" />
        <rect x="30" y="95" width="140" height="18" rx="4" fill="currentColor" opacity="0.15" />
        <rect x="92" y="95" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
        <rect x="44" y="28" width="112" height="68" rx="8" fill="currentColor" opacity="0.06" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
        <rect x="44" y="28" width="112" height="12" rx="8" fill="currentColor" opacity="0.12" />
        <circle cx="51" cy="34" r="1.6" fill="currentColor" opacity="0.4" />
        <circle cx="57" cy="34" r="1.6" fill="currentColor" opacity="0.4" />
        <circle cx="63" cy="34" r="1.6" fill="currentColor" opacity="0.4" />
        <rect x="54" y="50" width="14" height="3" rx="1.5" fill="#8b5cf6" opacity="0.8" />
        <rect x="72" y="50" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="54" y="60" width="22" height="3" rx="1.5" fill="#22c55e" opacity="0.8" />
        <rect x="80" y="60" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="62" y="70" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="94" y="70" width="18" height="3" rx="1.5" fill="#3b82f6" opacity="0.8" />
        <rect x="54" y="80" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
        <circle cx="148" cy="40" r="16" fill="#22c55e" />
        <path d="M140 40 l5.5 5.5 L156 35" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
          All shipped.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Nothing assigned to you right now. Time to take a breath — or pick up something new from the backlog.
        </div>
      </div>
    </div>
  );
}

function BugRow({ bug, accent, prLink, cta, busy, onAct, onOpenBug }) {
  const reporter = toName(bug.reporter);
  const router = useRouter();
  const openBug = () => onOpenBug ? onOpenBug(bug) : router.push(`/bugs?bug=${bug.id}`);

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
          {reporter && <span>by {reporter}</span>}
          {reporter && <span>·</span>}
          <span>{relativeDate(bug.updatedAt || bug.createdAt)}</span>
          {prLink && (
            <a href={prLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: '#8b5cf6', textDecoration: 'none', fontWeight: 500
            }}>
              · <GitPullRequest size={11} /> PR <ExternalLink size={9} />
            </a>
          )}
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
        {cta && (
          <button
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onAct(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: 'none', cursor: busy ? 'wait' : 'pointer',
              backgroundColor: cta.tone, color: 'white',
              fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap',
              opacity: busy ? 0.6 : 1
            }}>
            {busy ? '...' : cta.label} <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function PRModal({ bug, value, onChange, onCancel, onSubmit, busy }) {
  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(460px, 92vw)',
        backgroundColor: 'var(--color-bg-surface)',
        borderRadius: 20, padding: 28,
        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#8b5cf622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitPullRequest size={20} color="#8b5cf6" />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Attach PR</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{bug.title}</div>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Pull Request URL
        </label>
        <input
          autoFocus
          type="url"
          placeholder="https://github.com/org/repo/pull/123"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSubmit(); }}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            border: '2px solid var(--color-border)',
            fontSize: '0.9rem', fontWeight: 600,
            backgroundColor: 'var(--color-bg-body)',
            color: 'var(--color-text-main)', outline: 'none'
          }}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '10px 0 22px' }}>
          The bug will move to <strong>In PR</strong> and QA will be notified to review.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px', borderRadius: 12,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-muted)',
            fontWeight: 500, cursor: 'pointer'
          }}>Cancel</button>
          <button
            onClick={onSubmit}
            disabled={!value.trim() || busy}
            style={{
              flex: 1.5, padding: '12px', borderRadius: 12,
              border: 'none', backgroundColor: '#8b5cf6',
              color: 'white', fontWeight: 600, cursor: value.trim() ? 'pointer' : 'not-allowed',
              opacity: value.trim() && !busy ? 1 : 0.5
            }}>
            {busy ? 'Saving...' : 'Raise PR'}
          </button>
        </div>
      </div>
    </div>
  );
}

function priorityTint(p) {
  const v = String(p || '').toLowerCase();
  if (v === 'critical') return '#dc2626';
  if (v === 'high') return '#ea580c';
  if (v === 'medium') return '#f59e0b';
  if (v === 'low') return '#22c55e';
  return '#64748b';
}
