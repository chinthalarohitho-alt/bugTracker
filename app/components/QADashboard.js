"use client";
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitPullRequest, FlaskConical, CheckCircle2,
  ArrowRight, ExternalLink, AlertTriangle
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

const STATUS_META = {
  'Needs Dev':        { status: 'Open',              color: '#3b82f6', icon: AlertTriangle, hint: 'Waiting for a developer to pick this up.' },
  'Review PR':        { status: 'In PR',             color: '#8b5cf6', icon: GitPullRequest,  hint: 'Dev raised a PR — review it. Moves on automatically when they deploy.' },
  'Verify on Dev':    { status: 'In Testing',        color: '#06b6d4', icon: FlaskConical,    hint: 'Deployed to dev environment. Verify the fix.' }
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

const NOTIFIED_KEY = 'qa_reviewed_bugs';

function loadNotifiedIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveNotifiedIds(set) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(set))); } catch {}
}

export default function QADashboard({ bugs, currentReporter, onUpdateBug, onOpenBug }) {
  const [busyId, setBusyId] = useState(null);
  const [prStatuses, setPrStatuses] = useState({}); // url -> { status, label, ... }
  const [prLoading, setPrLoading] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState(() => loadNotifiedIds());

  const mine = useMemo(
    () => bugs.filter(b => toName(b.reporter) === currentReporter),
    [bugs, currentReporter]
  );

  // Fetch real GitHub PR state for every attached PR URL on the user's bugs.
  useEffect(() => {
    const urls = Array.from(new Set(
      mine.flatMap(b => (Array.isArray(b.githubPr) ? b.githubPr : (b.githubPr ? [b.githubPr] : [])))
        .filter(u => typeof u === 'string' && u.includes('github.com'))
    ));
    if (urls.length === 0) { setPrStatuses({}); setPrLoading(false); return; }
    let aborted = false;
    setPrLoading(true);
    fetch('/api/github/pr-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (aborted) return;
        if (data?.statuses) {
          const map = {};
          data.statuses.forEach(s => { map[s.url] = s; });
          setPrStatuses(map);
        }
        setPrLoading(false);
      })
      .catch(() => { if (!aborted) setPrLoading(false); });
    return () => { aborted = true; };
  }, [mine]);

  const columns = useMemo(() => {
    const buckets = { 'Needs Dev': [], 'Review PR': [], 'Verify on Dev': [] };
    mine.forEach(b => {
      if (['Closed', 'Resolved'].includes(b.status)) return;
      const pr = lastPr(b);
      const prInfo = pr ? prStatuses[pr] : null;
      const hasOpenPR = prInfo?.status === 'open';
      const s = b.status;

      if (hasOpenPR) {
        buckets['Review PR'].push(b);
      } else if (['In Testing', 'UAT', 'Testing', 'QA'].includes(s)) {
        buckets['Verify on Dev'].push(b);
      } else if (['In PR', 'Code Review', 'Review', 'In Review'].includes(s)) {
        // PR status unknown or not open yet — still belongs in Review PR by its bug status.
        buckets['Review PR'].push(b);
      } else if (s === 'Open' || s === 'ReOpen') {
        buckets['Needs Dev'].push(b);
      }
    });
    return buckets;
  }, [mine, prStatuses]);

  const handleAdvance = useCallback(async (bug, nextStatus) => {
    if (busyId) return;
    setBusyId(bug.id);
    try {
      await onUpdateBug({ ...bug, status: nextStatus, updatedBy: currentReporter });
    } finally {
      setBusyId(null);
    }
  }, [busyId, onUpdateBug, currentReporter]);

  const actionFor = (columnKey) => {
    if (columnKey === 'Verify on Dev') {
      return { label: 'Verified — Close Bug', next: 'Closed', tone: '#22c55e' };
    }
    return null;
  };

  const notifyDev = useCallback(async (bug) => {
    if (busyId || notifiedIds.has(bug.id)) return;
    setBusyId(bug.id);
    const assignee = toName(bug.assignee);
    try {
      if (assignee && assignee !== currentReporter) {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_user: assignee,
            actor: currentReporter || 'QA',
            bug_id: bug.id,
            message: `${currentReporter || 'QA'} reviewed the PR — ready to deploy`
          })
        });
      }
      setNotifiedIds(prev => {
        const next = new Set(prev);
        next.add(bug.id);
        saveNotifiedIds(next);
        return next;
      });
    } catch (err) {
      console.error('Notify failed:', err);
    } finally {
      setBusyId(null);
    }
  }, [busyId, notifiedIds, currentReporter]);

  const sections = [
    { key: 'Verify on Dev', list: columns['Verify on Dev'] },
    { key: 'Review PR',     list: columns['Review PR'] },
    { key: 'Needs Dev',     list: columns['Needs Dev'] },
  ];

  const totalOpen = sections.reduce((n, s) => n + s.list.length, 0);

  if (totalOpen === 0 && !prLoading) {
    return <QAEmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
        {`${totalOpen} open ${totalOpen === 1 ? 'bug' : 'bugs'} across your work.`}
      </div>

      {sections.map(({ key, list }) => {
        const meta = STATUS_META[key];
        const Icon = meta.icon;
        const isLoadingReview = key === 'Review PR' && prLoading && list.length === 0;
        if (list.length === 0 && !isLoadingReview) return null;

        if (isLoadingReview) {
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
                }}>0</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--chrome-border)' }}>
                <LoadingRow tone={meta.color} />
              </div>
            </section>
          );
        }

        return (
          <CollapsibleSection
            key={key}
            icon={meta.icon}
            color={meta.color}
            label={key}
            items={list}
            renderItem={(bug) => {
              const action = actionFor(key, bug);
              const prLink = lastPr(bug);
              const reviewAction = key === 'Review PR'
                ? (notifiedIds.has(bug.id)
                    ? { label: 'Reviewed — Dev notified', tone: '#22c55e', done: true }
                    : { label: 'Reviewed — Notify Dev', tone: '#8b5cf6' })
                : null;
              return (
                <BugRow
                  key={bug.id}
                  bug={bug}
                  accent={meta.color}
                  showAssignee
                  prLink={prLink}
                  prStatus={prLink ? prStatuses[prLink] : null}
                  action={action}
                  reviewAction={reviewAction}
                  busy={busyId === bug.id}
                  onAct={() => action && handleAdvance(bug, action.next)}
                  onReview={() => notifyDev(bug)}
                  onOpenBug={onOpenBug}
                />
              );
            }}
          />
        );
      })}
    </div>
  );
}

function QAEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px 40px', gap: 18, color: 'var(--color-text-muted)'
    }}>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="138" rx="58" ry="4" fill="currentColor" opacity="0.08" />
        <rect x="58" y="22" width="84" height="110" rx="8" fill="currentColor" opacity="0.06" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
        <rect x="80" y="14" width="40" height="14" rx="4" fill="currentColor" opacity="0.2" />
        <rect x="88" y="18" width="24" height="6" rx="2" fill="currentColor" opacity="0.35" />
        <circle cx="72" cy="48" r="5" fill="#22c55e" />
        <path d="M69 48 l2 2 l4 -4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="82" y="46" width="46" height="3.5" rx="1.75" fill="currentColor" opacity="0.4" />
        <circle cx="72" cy="66" r="5" fill="#22c55e" />
        <path d="M69 66 l2 2 l4 -4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="82" y="64" width="52" height="3.5" rx="1.75" fill="currentColor" opacity="0.4" />
        <circle cx="72" cy="84" r="5" fill="#22c55e" />
        <path d="M69 84 l2 2 l4 -4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="82" y="82" width="38" height="3.5" rx="1.75" fill="currentColor" opacity="0.4" />
        <circle cx="72" cy="102" r="5" fill="#22c55e" />
        <path d="M69 102 l2 2 l4 -4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="82" y="100" width="48" height="3.5" rx="1.75" fill="currentColor" opacity="0.4" />
        <circle cx="72" cy="120" r="5" fill="#22c55e" />
        <path d="M69 120 l2 2 l4 -4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="82" y="118" width="34" height="3.5" rx="1.75" fill="currentColor" opacity="0.4" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
          Inbox zero.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          No bugs need your attention — every fix has been verified. Nice work keeping the pipeline clean.
        </div>
      </div>
    </div>
  );
}

function LoadingRow({ tone }) {
  return (
    <div style={{
      padding: '20px 14px', textAlign: 'center',
      border: `1px dashed ${tone}33`,
      borderRadius: 12, color: 'var(--color-text-light)',
      fontSize: '0.8rem', fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        border: `2px solid ${tone}44`, borderTopColor: tone,
        animation: 'qa-spin 0.8s linear infinite'
      }} />
      Checking PR status…
      <style jsx>{`
        @keyframes qa-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function BugRow({ bug, accent, showAssignee, prLink, prStatus, action, reviewAction, busy, onAct, onReview, onOpenBug }) {
  const assignee = toName(bug.assignee);
  const router = useRouter();
  const openBug = () => onOpenBug ? onOpenBug(bug) : router.push(`/bugs?bug=${bug.id}`);
  const primaryAction = action || reviewAction;
  const onPrimary = (e) => {
    e.stopPropagation();
    if (action) onAct();
    else if (reviewAction && !reviewAction.done) onReview?.();
  };

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
          {showAssignee && assignee && <span>{assignee}</span>}
          {showAssignee && assignee && <span>·</span>}
          <span>{relativeDate(bug.updatedAt || bug.createdAt)}</span>
          {prLink && (
            <a href={prLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: '#8b5cf6', textDecoration: 'none', fontWeight: 500
            }}>
              · <GitPullRequest size={11} /> PR <ExternalLink size={9} />
            </a>
          )}
          {prStatus && <PrBadge status={prStatus} />}
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
        {primaryAction && (
          <button
            disabled={busy || reviewAction?.done}
            onClick={onPrimary}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: reviewAction?.done ? `1px solid ${reviewAction.tone}55` : 'none',
              cursor: reviewAction?.done ? 'default' : (busy ? 'wait' : 'pointer'),
              backgroundColor: reviewAction?.done ? `${reviewAction.tone}15` : primaryAction.tone,
              color: reviewAction?.done ? reviewAction.tone : 'white',
              fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap',
              opacity: busy && !reviewAction?.done ? 0.6 : 1
            }}>
            {reviewAction?.done
              ? <><CheckCircle2 size={12} /> Notified</>
              : <>{busy ? '...' : primaryAction.label.split(' — ')[0]} <ArrowRight size={12} /></>}
          </button>
        )}
      </div>
    </div>
  );
}


const PR_TONES = {
  open:      { bg: '#dcfce7', fg: '#166534', label: 'PR Open' },
  merged:    { bg: '#ede9fe', fg: '#5b21b6', label: 'Merged' },
  closed:    { bg: '#fee2e2', fg: '#991b1b', label: 'PR Closed' },
  not_found: { bg: '#f1f5f9', fg: '#475569', label: 'PR Missing' },
  invalid:   { bg: '#f1f5f9', fg: '#475569', label: 'Invalid' },
  error:     { bg: '#fef3c7', fg: '#92400e', label: 'PR ?' }
};

function PrBadge({ status }) {
  const tone = PR_TONES[status.status] || PR_TONES.error;
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', borderRadius: 999,
      backgroundColor: tone.bg, color: tone.fg,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
    }}>{tone.label}</span>
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
