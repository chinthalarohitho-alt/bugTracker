"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Edit3, Trash2, X, ChevronDown, Check,
  Bug, Users, Folder, Lightbulb, AlertTriangle, Activity, TrendingUp, Target
} from 'lucide-react';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';

const CATEGORY_META = {
  strategy:   { label: 'Strategy',   color: '#2563eb' },
  hire:       { label: 'Hire',       color: '#a855f7' },
  product:    { label: 'Product',    color: '#0ea5e9' },
  investment: { label: 'Investment', color: '#22c55e' },
  vendor:     { label: 'Vendor',     color: '#f59e0b' },
  other:      { label: 'Other',      color: '#64748b' },
};
const CATEGORY_ORDER = ['strategy', 'hire', 'product', 'investment', 'vendor', 'other'];

const STATUS_META = {
  exploring: { label: 'Exploring', color: '#64748b' },
  decided:   { label: 'Decided',   color: '#2563eb' },
  blocked:   { label: 'Blocked',   color: '#ef4444' },
  done:      { label: 'Done',      color: '#22c55e' },
};
const STATUS_ORDER = ['exploring', 'decided', 'blocked', 'done'];

async function apiCall(method, body) {
  const res = await fetch('/api/founder-hub', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch {}
    throw new Error(`${res.status}${detail ? ` – ${detail}` : ''}`);
  }
  return res.json();
}

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const toName = (v) => {
  if (typeof v === 'object' && v !== null) return v.name || '';
  if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
  return v || '';
};

export default function FounderHubPage() {
  const { currentReporter, globalBugs, globalSettings } = useAuth();

  const [decisions, setDecisions] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  useEffect(() => {
    if (typeof window === 'undefined' || !currentReporter) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/founder-hub?owner=${encodeURIComponent(currentReporter)}`);
        const data = await res.json();
        if (!cancelled) setDecisions(Array.isArray(data.decisions) ? data.decisions : []);
      } catch (err) {
        console.error('founder-hub load failed:', err);
        if (!cancelled) setDecisions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentReporter]);

  const showToast = (message) => {
    if (typeof window !== 'undefined' && window.__founderToastTimer) clearTimeout(window.__founderToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__founderToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  };

  const safeApi = async (method, body, errorLabel) => {
    try {
      await apiCall(method, body);
    } catch (err) {
      console.error('founder-hub', method, err);
      showToast(`${errorLabel}: ${err.message}`);
    }
  };

  // === Cross-team insights from existing data ===
  const insights = useMemo(() => {
    const bugs = Array.isArray(globalBugs) ? globalBugs : [];
    const settings = globalSettings || {};
    const closedSet = new Set(['Resolved', 'Closed']);
    const open = bugs.filter(b => !closedSet.has(b.status));
    const critical = open.filter(b => (b.priority || '').toLowerCase() === 'critical');
    const high = open.filter(b => (b.priority || '').toLowerCase() === 'high');
    const medium = open.filter(b => (b.priority || '').toLowerCase() === 'medium');
    const low = open.filter(b => (b.priority || '').toLowerCase() === 'low');

    const weekAgo = Date.now() - 7 * 86400000;
    const createdThisWeek = bugs.filter(b => new Date(b.createdAt).getTime() >= weekAgo).length;
    const closedThisWeek = bugs.filter(b => closedSet.has(b.status) && new Date(b.updatedAt || b.createdAt).getTime() >= weekAgo).length;

    const overdue = open.filter(b => b.endDate && new Date(b.endDate) < new Date()).length;

    const loadByAssignee = {};
    open.forEach(b => {
      const a = toName(b.assignee);
      if (!a || a === 'Unassigned' || a === 'Not Assigned') return;
      loadByAssignee[a] = (loadByAssignee[a] || 0) + 1;
    });
    const topAssignees = Object.entries(loadByAssignee)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const recent = [...bugs]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 6);

    const teamCount = (settings.assignees || [])
      .filter(a => {
        const n = toName(a);
        return n && n !== 'Unassigned' && n !== 'Not Assigned';
      }).length;

    const projectCount = (settings.projects || []).filter(Boolean).length;

    return {
      bugs: { total: bugs.length, open: open.length, critical: critical.length, high: high.length, medium: medium.length, low: low.length },
      flow: { createdThisWeek, closedThisWeek, overdue },
      topAssignees,
      recent,
      teamCount,
      projectCount,
    };
  }, [globalBugs, globalSettings]);

  // === Decisions filters & list ===
  const filtered = useMemo(() => {
    if (!decisions) return [];
    let list = decisions;
    if (categoryFilter !== 'all') list = list.filter(d => d.category === categoryFilter);
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.decision || '').toLowerCase().includes(q) ||
        (d.rationale || '').toLowerCase().includes(q) ||
        (d.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [decisions, categoryFilter, statusFilter, search]);

  const updateDecision = (id, changes, { sync = true } = {}) => {
    setDecisions(prev => (prev || []).map(d => d.id === id ? { ...d, ...changes, updatedAt: new Date().toISOString() } : d));
    if (sync) safeApi('PUT', { owner: currentReporter, id, changes }, 'Update failed');
  };

  const deleteDecision = (id) => {
    const target = (decisions || []).find(d => d.id === id);
    setDecisions(prev => (prev || []).filter(d => d.id !== id));
    if (target) showToast(`Removed "${target.title}"`);
    safeApi('DELETE', { owner: currentReporter, id }, 'Delete failed');
  };

  const saveDecision = (data) => {
    if (editingId) {
      updateDecision(editingId, data);
      showToast('Updated');
    } else {
      const item = {
        id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      setDecisions(prev => [item, ...(prev || [])]);
      safeApi('POST', { owner: currentReporter, decision: item }, 'Save failed');
      showToast('Decision logged');
    }
    setAdding(false);
    setEditingId(null);
  };

  if (decisions === null) {
    return <LoadingOverlay message="Loading Founder Hub" subtext="Fetching insights and decisions..." />;
  }

  return (
    <main style={{ width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      <PageHeader
        context="Executive"
        title="Founder Hub"
        subtitle="Cross-team pulse and your strategic decisions log."
        actions={
          <button onClick={() => setAdding(true)} className="topbar-pill primary">
            <Plus size={15} strokeWidth={2.2} /> Log Decision
          </button>
        }
      />

      {/* Pulse strip */}
      <div style={{
        display: 'grid', gap: 12, marginBottom: 22,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
      }}>
        <Kpi
          icon={Bug} color="#ef4444"
          label="Open bugs"
          value={insights.bugs.open}
          sub={insights.bugs.critical > 0 ? `${insights.bugs.critical} critical` : 'No critical bugs'}
        />
        <Kpi
          icon={Activity} color="#0ea5e9"
          label="This week"
          value={`+${insights.flow.createdThisWeek} · −${insights.flow.closedThisWeek}`}
          sub="Created · Closed"
        />
        <Kpi
          icon={Users} color="#8b5cf6"
          label="Team"
          value={insights.teamCount}
          sub={`Across ${insights.projectCount} ${insights.projectCount === 1 ? 'project' : 'projects'}`}
        />
        <Kpi
          icon={Lightbulb} color="#f59e0b"
          label="Decisions logged"
          value={decisions.length}
          sub={`${decisions.filter(d => d.status === 'exploring').length} in flight`}
        />
      </div>

      {insights.flow.overdue > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, marginBottom: 18,
          backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--color-bg-surface))',
          border: '1px solid color-mix(in srgb, #ef4444 22%, transparent)',
          color: '#ef4444', fontSize: '0.85rem', fontWeight: 700
        }}>
          <AlertTriangle size={16} />
          {insights.flow.overdue} bug{insights.flow.overdue === 1 ? '' : 's'} past deadline
        </div>
      )}

      {/* Two-column insights row */}
      <div style={{
        display: 'grid', gap: 12, marginBottom: 28,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
      }}>
        <InsightCard title="Open bugs by priority" icon={Target} iconColor="#ef4444">
          {insights.bugs.open === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No open bugs. Clean slate.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Critical', count: insights.bugs.critical, color: '#dc2626' },
                { label: 'High',     count: insights.bugs.high,     color: '#ea580c' },
                { label: 'Medium',   count: insights.bugs.medium,   color: '#ca8a04' },
                { label: 'Low',      count: insights.bugs.low,      color: '#475569' },
              ].map(({ label, count, color }) => {
                const pct = insights.bugs.open === 0 ? 0 : Math.round((count / insights.bugs.open) * 100);
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
                    <span style={{ width: 60, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'var(--color-bg-body)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 36, textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </InsightCard>

        <InsightCard title="Top load by assignee" icon={TrendingUp} iconColor="#8b5cf6">
          {insights.topAssignees.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No active assignments.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.topAssignees.map(({ name, count }) => {
                const max = insights.topAssignees[0].count;
                const pct = (count / max) * 100;
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
                    <span style={{ minWidth: 110, color: 'var(--color-text-main)', fontWeight: 600,
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{capitalizeName(name)}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'var(--color-bg-body)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#8b5cf6', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 36, textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </InsightCard>
      </div>

      {/* Recent activity */}
      {insights.recent.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionLabel icon={Activity} color="#0ea5e9" text="Recent bug activity" />
          <div style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 14, overflow: 'hidden'
          }}>
            {insights.recent.map((b, idx) => {
              const closedSet = new Set(['Resolved', 'Closed']);
              const isClosed = closedSet.has(b.status);
              return (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderBottom: idx < insights.recent.length - 1 ? '1px solid var(--color-border-light)' : 'none'
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '3px 8px', borderRadius: 6,
                    backgroundColor: isClosed ? 'color-mix(in srgb, #22c55e 14%, transparent)' : 'color-mix(in srgb, #0ea5e9 14%, transparent)',
                    color: isClosed ? '#22c55e' : '#0ea5e9',
                    flexShrink: 0
                  }}>{b.status}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-main)', flex: 1, fontWeight: 500,
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {capitalizeName(toName(b.assignee)) || '—'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', flexShrink: 0 }}>
                    {formatDate(b.updatedAt || b.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Decisions log section */}
      <SectionLabel icon={Lightbulb} color="#f59e0b" text="Strategic decisions" />

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <PillRow
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ k: 'all', label: 'All' }, ...CATEGORY_ORDER.map(k => ({ k, label: CATEGORY_META[k].label, accent: CATEGORY_META[k].color }))]}
        />
        <PillRow
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ k: 'all', label: 'All' }, ...STATUS_ORDER.map(k => ({ k, label: STATUS_META[k].label, accent: STATUS_META[k].color }))]}
        />
        <div style={{ marginLeft: 'auto', position: 'relative', minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search decisions, rationale, tags…"
            style={{
              width: '100%', padding: '8px 14px 8px 36px', borderRadius: 999,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              fontSize: '0.85rem', outline: 'none',
              color: 'var(--color-text-main)'
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <DecisionsEmpty
          totalCount={decisions.length}
          hasFilter={categoryFilter !== 'all' || statusFilter !== 'all' || search.trim().length > 0}
          onAdd={() => setAdding(true)}
        />
      ) : (
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
        }}>
          {filtered.map(d => (
            <DecisionCard
              key={d.id}
              decision={d}
              onEdit={() => setEditingId(d.id)}
              onDelete={() => deleteDecision(d.id)}
              onStatusChange={(status) => updateDecision(d.id, { status })}
            />
          ))}
        </div>
      )}

      {(adding || editingId) && (
        <DecisionFormModal
          existing={editingId ? decisions.find(d => d.id === editingId) : null}
          onSave={saveDecision}
          onClose={() => { setAdding(false); setEditingId(null); }}
        />
      )}

      <div style={{
        position: 'fixed', bottom: '32px', right: '32px',
        backgroundColor: '#ffffff', color: '#0f172a',
        padding: '12px 24px', borderRadius: '12px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.12)',
        zIndex: 9999, transition: 'all 0.3s',
        transform: toast.visible ? 'translateY(0)' : 'translateY(100px)',
        opacity: toast.visible ? 1 : 0
      }}>
        {toast.message}
      </div>
    </main>
  );
}

function Kpi({ icon: Icon, color, label, value, sub }) {
  return (
    <div style={{
      padding: 16, borderRadius: 14,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
          color, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={16} />
        </div>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sub}</div>
    </div>
  );
}

function InsightCard({ title, icon: Icon, iconColor, children }) {
  return (
    <div style={{
      padding: 18, borderRadius: 14,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon size={15} color={iconColor} />
        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-main)' }}>
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, color, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Icon size={16} color={color} />
      <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-main)' }}>
        {text}
      </div>
    </div>
  );
}

function PillRow({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(({ k, label, accent }) => {
        const active = value === k;
        const c = accent || 'var(--color-primary)';
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            style={{
              padding: '6px 12px', borderRadius: 999,
              border: '1px solid ' + (active ? c : 'var(--color-border)'),
              backgroundColor: active ? `color-mix(in srgb, ${c} 12%, var(--color-bg-surface))` : 'var(--color-bg-surface)',
              color: active ? c : 'var(--color-text-muted)',
              fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DecisionCard({ decision, onEdit, onDelete, onStatusChange }) {
  const cat = CATEGORY_META[decision.category] || CATEGORY_META.other;
  const status = STATUS_META[decision.status] || STATUS_META.exploring;

  return (
    <div style={{
      padding: 16, borderRadius: 14,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `4px solid ${cat.color}`,
      display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.3
          }}>{decision.title}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ color: cat.color }}>{cat.label}</span>
          </div>
        </div>
        <StatusSelect value={decision.status} onChange={onStatusChange} />
      </div>

      {decision.decision && (
        <div style={{
          fontSize: '0.85rem', color: 'var(--color-text-main)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>{decision.decision}</div>
      )}

      {decision.rationale && (
        <div style={{
          padding: '8px 10px', borderRadius: 8,
          backgroundColor: 'var(--color-bg-body)',
          fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>Why:</span> {decision.rationale}
        </div>
      )}

      {decision.tags && decision.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {decision.tags.map(t => (
            <span key={t} style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-muted)'
            }}>{t}</span>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 'auto', paddingTop: 10,
        borderTop: '1px solid var(--color-border-light)',
        fontSize: '0.7rem', color: 'var(--color-text-muted)'
      }}>
        <span>{formatDate(decision.updatedAt || decision.createdAt)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <IconButton title="Edit" onClick={onEdit}><Edit3 size={13} color="var(--color-text-light)" /></IconButton>
          <IconButton title="Delete" onClick={onDelete}><Trash2 size={13} color="var(--color-text-light)" /></IconButton>
        </div>
      </div>
    </div>
  );
}

function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = STATUS_META[value] || STATUS_META.exploring;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 6px', borderRadius: 6,
          border: 'none', background: 'transparent',
          color: 'var(--color-text-main)',
          fontSize: '0.78rem', fontWeight: 500,
          cursor: 'pointer', outline: 'none'
        }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: meta.color }} />
        {meta.label}
        <ChevronDown size={11} color="var(--color-text-muted)"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          minWidth: 140, backgroundColor: 'var(--chrome-bg-raised)',
          borderRadius: 10, boxShadow: '0 12px 28px -8px rgba(0,0,0,0.18)',
          padding: 4, zIndex: 200
        }}>
          {STATUS_ORDER.map(s => {
            const m = STATUS_META[s];
            const active = value === s;
            return (
              <button
                key={s} type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: active ? 'var(--color-bg-body)' : 'transparent',
                  color: 'var(--color-text-main)',
                  fontSize: '0.82rem', fontWeight: active ? 600 : 500, textAlign: 'left'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: m.color }} />
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconButton({ children, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 6,
        border: 'none', backgroundColor: 'transparent', cursor: 'pointer'
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
      {children}
    </button>
  );
}

function DecisionsEmpty({ totalCount, hasFilter, onAdd }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 20px',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: 14, border: '1px dashed var(--color-border)'
    }}>
      <Lightbulb size={32} color="var(--color-text-light)" style={{ marginBottom: 12 }} />
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>
        {totalCount === 0 ? 'No decisions logged yet' : 'No matching decisions'}
      </h3>
      <p style={{
        fontSize: '0.82rem', color: 'var(--color-text-muted)',
        maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.5
      }}>
        {totalCount === 0
          ? 'Capture strategic calls — hires, product bets, vendor choices — alongside your reasoning.'
          : 'Try a different filter or search term.'}
      </p>
      {!hasFilter && (
        <button onClick={onAdd} className="topbar-pill primary" style={{ display: 'inline-flex' }}>
          <Plus size={14} strokeWidth={2.2} /> Log a decision
        </button>
      )}
    </div>
  );
}

function DecisionFormModal({ existing, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    title: existing?.title || '',
    category: existing?.category || 'strategy',
    status: existing?.status || 'exploring',
    decision: existing?.decision || '',
    rationale: existing?.rationale || '',
    tagsText: (existing?.tags || []).join(', '),
  }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsText.split(',').map(t => t.trim()).filter(Boolean);
    onSave({
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      decision: form.decision.trim(),
      rationale: form.rationale.trim(),
      tags,
    });
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-surface)',
    fontSize: '0.9rem', outline: 'none',
    color: 'var(--color-text-main)', fontFamily: 'inherit'
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}
           style={{ maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {existing ? 'Edit decision' : 'Log a decision'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title *">
            <input value={form.title} onChange={e => set('title', e.target.value)}
                   placeholder="Hire senior backend engineer" autoFocus required style={inputStyle} />
          </Field>

          <Field label="Category">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORY_ORDER.map(k => {
                const meta = CATEGORY_META[k];
                const active = form.category === k;
                return (
                  <button key={k} type="button" onClick={() => set('category', k)}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: '1px solid ' + (active ? meta.color : 'var(--color-border)'),
                      backgroundColor: active ? `color-mix(in srgb, ${meta.color} 14%, transparent)` : 'var(--color-bg-surface)',
                      color: active ? meta.color : 'var(--color-text-muted)',
                      fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                    }}>{meta.label}</button>
                );
              })}
            </div>
          </Field>

          <Field label="Status">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_ORDER.map(k => {
                const meta = STATUS_META[k];
                const active = form.status === k;
                return (
                  <button key={k} type="button" onClick={() => set('status', k)}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: '1px solid ' + (active ? meta.color : 'var(--color-border)'),
                      backgroundColor: active ? `color-mix(in srgb, ${meta.color} 14%, transparent)` : 'var(--color-bg-surface)',
                      color: active ? meta.color : 'var(--color-text-muted)',
                      fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                    }}>{meta.label}</button>
                );
              })}
            </div>
          </Field>

          <Field label="Decision">
            <textarea value={form.decision} onChange={e => set('decision', e.target.value)}
              placeholder="What you're going to do…"
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
          </Field>

          <Field label="Rationale">
            <textarea value={form.rationale} onChange={e => set('rationale', e.target.value)}
              placeholder="Why — context, trade-offs, what you considered…"
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          </Field>

          <Field label="Tags (comma separated)">
            <input value={form.tagsText} onChange={e => set('tagsText', e.target.value)}
                   placeholder="Q2, growth, infra" style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer'
            }}>Cancel</button>
            <button type="submit" disabled={!form.title.trim()} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: 'none', backgroundColor: '#0f172a', color: 'white',
              fontWeight: 700,
              cursor: form.title.trim() ? 'pointer' : 'not-allowed',
              opacity: form.title.trim() ? 1 : 0.5
            }}>{existing ? 'Save changes' : 'Log decision'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--color-text-muted)'
      }}>{label}</span>
      {children}
    </label>
  );
}
