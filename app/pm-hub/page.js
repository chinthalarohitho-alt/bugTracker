"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Edit3, Trash2, X, ChevronDown,
  Folder, Calendar, Target, Flag, Clock, Users
} from 'lucide-react';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';

const M_STATUS_META = {
  planned:     { label: 'Planned',     color: '#64748b' },
  in_progress: { label: 'In progress', color: '#0ea5e9' },
  done:        { label: 'Done',        color: '#22c55e' },
  blocked:     { label: 'Blocked',     color: '#ef4444' },
};
const M_STATUS_ORDER = ['planned', 'in_progress', 'done', 'blocked'];

const SEVERITY_META = {
  low:      { label: 'Low',      color: '#64748b' },
  medium:   { label: 'Medium',   color: '#ca8a04' },
  high:     { label: 'High',     color: '#ea580c' },
  critical: { label: 'Critical', color: '#dc2626' },
};
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

const R_STATUS_META = {
  open:      { label: 'Open',      color: '#ef4444' },
  mitigated: { label: 'Mitigated', color: '#f59e0b' },
  accepted:  { label: 'Accepted',  color: '#0ea5e9' },
  closed:    { label: 'Closed',    color: '#64748b' },
};
const R_STATUS_ORDER = ['open', 'mitigated', 'accepted', 'closed'];

async function apiCall(method, body) {
  const res = await fetch('/api/pm-hub', {
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

const daysBetween = (iso) => {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
};

const toName = (v) => {
  if (typeof v === 'object' && v !== null) return v.name || '';
  if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
  return v || '';
};

export default function PMHubPage() {
  const { currentReporter, globalBugs, globalSettings } = useAuth();
  const projectOptions = useMemo(
    () => (globalSettings?.projects || []).filter(Boolean),
    [globalSettings]
  );

  const [data, setData] = useState(null); // { milestones, risks }
  const [activeTab, setActiveTab] = useState('portfolio'); // portfolio | milestones | risks
  const [search, setSearch] = useState('');
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [editingRiskId, setEditingRiskId] = useState(null);
  const [addingRisk, setAddingRisk] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  useEffect(() => {
    if (typeof window === 'undefined' || !currentReporter) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pm-hub?owner=${encodeURIComponent(currentReporter)}`);
        const json = await res.json();
        if (!cancelled) setData({
          milestones: Array.isArray(json.milestones) ? json.milestones : [],
          risks:      Array.isArray(json.risks)      ? json.risks      : [],
        });
      } catch (err) {
        console.error('pm-hub load failed:', err);
        if (!cancelled) setData({ milestones: [], risks: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [currentReporter]);

  const showToast = (message) => {
    if (typeof window !== 'undefined' && window.__pmToastTimer) clearTimeout(window.__pmToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__pmToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  };

  const safeApi = async (method, body, label) => {
    try { await apiCall(method, body); }
    catch (err) { console.error('pm-hub', method, err); showToast(`${label}: ${err.message}`); }
  };

  // Project portfolio derived from bugs
  const portfolio = useMemo(() => {
    const bugs = Array.isArray(globalBugs) ? globalBugs : [];
    const closedSet = new Set(['Resolved', 'Closed']);
    const projects = projectOptions.length > 0
      ? projectOptions
      : [...new Set(bugs.map(b => b.project).filter(Boolean))];

    return projects.map(project => {
      const projectBugs = bugs.filter(b => b.project === project);
      const open = projectBugs.filter(b => !closedSet.has(b.status));
      const overdue = open.filter(b => b.endDate && new Date(b.endDate) < new Date()).length;
      const critical = open.filter(b => (b.priority || '').toLowerCase() === 'critical').length;
      const high = open.filter(b => (b.priority || '').toLowerCase() === 'high').length;
      const loadByAssignee = {};
      open.forEach(b => {
        const a = toName(b.assignee);
        if (!a || a === 'Unassigned' || a === 'Not Assigned') return;
        loadByAssignee[a] = (loadByAssignee[a] || 0) + 1;
      });
      const topAssignees = Object.entries(loadByAssignee)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
      const health = critical > 0 || overdue > 2 ? 'red' : (high > 2 || overdue > 0 ? 'amber' : 'green');
      return { project, total: projectBugs.length, open: open.length, overdue, critical, high, topAssignees, health };
    });
  }, [globalBugs, projectOptions]);

  const insights = useMemo(() => {
    if (!data) return null;
    const ms = data.milestones;
    const rs = data.risks;
    const openMs = ms.filter(m => m.status !== 'done');
    const overdueMs = openMs.filter(m => m.dueDate && new Date(m.dueDate) < new Date()).length;
    const dueSoonMs = openMs.filter(m => {
      if (!m.dueDate) return false;
      const d = daysBetween(m.dueDate);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const openRisks = rs.filter(r => r.status === 'open').length;
    const highRisks = rs.filter(r => r.status === 'open' && (r.severity === 'high' || r.severity === 'critical')).length;
    return {
      milestonesOpen: openMs.length, milestonesOverdue: overdueMs, milestonesDueSoon: dueSoonMs,
      risksOpen: openRisks, risksHigh: highRisks,
      projectHealth: portfolio.reduce((acc, p) => { acc[p.health] = (acc[p.health] || 0) + 1; return acc; }, {}),
    };
  }, [data, portfolio]);

  const filteredMilestones = useMemo(() => {
    if (!data) return [];
    let list = data.milestones;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.project || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, search]);

  const filteredRisks = useMemo(() => {
    if (!data) return [];
    let list = data.risks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.project || '').toLowerCase().includes(q) ||
        (r.mitigation || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, search]);

  // Milestone mutations
  const updateMilestone = (id, changes) => {
    setData(prev => prev ? { ...prev, milestones: prev.milestones.map(m => m.id === id ? { ...m, ...changes, updatedAt: new Date().toISOString() } : m) } : prev);
    safeApi('PUT', { owner: currentReporter, kind: 'milestone', id, changes }, 'Update failed');
  };
  const deleteMilestone = (id) => {
    const t = data?.milestones.find(m => m.id === id);
    setData(prev => prev ? { ...prev, milestones: prev.milestones.filter(m => m.id !== id) } : prev);
    if (t) showToast(`Removed "${t.title}"`);
    safeApi('DELETE', { owner: currentReporter, kind: 'milestone', id }, 'Delete failed');
  };
  const saveMilestone = (formData) => {
    if (editingMilestoneId) {
      updateMilestone(editingMilestoneId, formData);
      showToast('Updated');
      setEditingMilestoneId(null);
    } else {
      const item = { id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...formData };
      setData(prev => prev ? { ...prev, milestones: [...prev.milestones, item] } : prev);
      safeApi('POST', { owner: currentReporter, kind: 'milestone', payload: item }, 'Save failed');
      showToast('Milestone added');
      setAddingMilestone(false);
    }
  };

  // Risk mutations
  const updateRisk = (id, changes) => {
    setData(prev => prev ? { ...prev, risks: prev.risks.map(r => r.id === id ? { ...r, ...changes, updatedAt: new Date().toISOString() } : r) } : prev);
    safeApi('PUT', { owner: currentReporter, kind: 'risk', id, changes }, 'Update failed');
  };
  const deleteRisk = (id) => {
    const t = data?.risks.find(r => r.id === id);
    setData(prev => prev ? { ...prev, risks: prev.risks.filter(r => r.id !== id) } : prev);
    if (t) showToast(`Removed "${t.title}"`);
    safeApi('DELETE', { owner: currentReporter, kind: 'risk', id }, 'Delete failed');
  };
  const saveRisk = (formData) => {
    if (editingRiskId) {
      updateRisk(editingRiskId, formData);
      showToast('Updated');
      setEditingRiskId(null);
    } else {
      const item = { id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...formData };
      setData(prev => prev ? { ...prev, risks: [item, ...prev.risks] } : prev);
      safeApi('POST', { owner: currentReporter, kind: 'risk', payload: item }, 'Save failed');
      showToast('Risk logged');
      setAddingRisk(false);
    }
  };

  if (data === null) {
    return <LoadingOverlay message="Loading PM Hub" subtext="Fetching projects, milestones, risks..." />;
  }

  return (
    <main style={{ width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      <PageHeader
        context="Delivery"
        title="PM Hub"
        subtitle="Project portfolio health, milestones, and risk register."
        actions={
          activeTab === 'milestones' ? (
            <button onClick={() => setAddingMilestone(true)} className="topbar-pill primary">
              <Plus size={15} strokeWidth={2.2} /> Add Milestone
            </button>
          ) : activeTab === 'risks' ? (
            <button onClick={() => setAddingRisk(true)} className="topbar-pill primary">
              <Plus size={15} strokeWidth={2.2} /> Log Risk
            </button>
          ) : null
        }
      />

      <div style={{
        display: 'grid', gap: 12, marginBottom: 22,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
      }}>
        <Kpi
          icon={Folder} color="#2563eb"
          label="Projects"
          value={portfolio.length}
          sub={`${insights.projectHealth.green || 0} green · ${insights.projectHealth.amber || 0} amber · ${insights.projectHealth.red || 0} red`}
        />
        <Kpi
          icon={Target} color="#0ea5e9"
          label="Open milestones"
          value={insights.milestonesOpen}
          sub={`${insights.milestonesDueSoon} due in 7d`}
        />
        <Kpi
          icon={Clock} color="#ef4444"
          label="Overdue milestones"
          value={insights.milestonesOverdue}
          sub={insights.milestonesOverdue === 0 ? 'On schedule' : 'Past due date'}
        />
        <Kpi
          icon={Flag} color="#f59e0b"
          label="Open risks"
          value={insights.risksOpen}
          sub={`${insights.risksHigh} high/critical`}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 18 }}>
        {[
          { k: 'portfolio',  label: 'Portfolio',  count: portfolio.length },
          { k: 'milestones', label: 'Milestones', count: data.milestones.length },
          { k: 'risks',      label: 'Risks',      count: data.risks.length },
        ].map(({ k, label, count }) => {
          const active = activeTab === k;
          return (
            <button key={k} onClick={() => setActiveTab(k)}
              style={{
                padding: '10px 16px', border: 'none',
                borderBottom: '2px solid ' + (active ? 'var(--color-primary)' : 'transparent'),
                background: 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', marginBottom: -1
              }}>
              {label} <span style={{ opacity: 0.6 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {(activeTab === 'milestones' || activeTab === 'risks') && (
        <div style={{ marginBottom: 18, position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={activeTab === 'milestones' ? 'Search milestones…' : 'Search risks…'}
            style={{
              width: '100%', padding: '8px 14px 8px 36px', borderRadius: 999,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              fontSize: '0.85rem', outline: 'none',
              color: 'var(--color-text-main)'
            }}
          />
        </div>
      )}

      {activeTab === 'portfolio' && (
        portfolio.length === 0 ? (
          <Empty icon={Folder} title="No projects yet" body="Add projects in Settings → Projects." />
        ) : (
          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
          }}>
            {portfolio.map(p => <ProjectCard key={p.project} entry={p} />)}
          </div>
        )
      )}

      {activeTab === 'milestones' && (
        filteredMilestones.length === 0 ? (
          <Empty
            icon={Target} title={data.milestones.length === 0 ? "No milestones yet" : "No matches"}
            body={data.milestones.length === 0 ? "Track key deliverables with due dates and status." : "Try a different search."}
            action={data.milestones.length === 0 ? { label: 'Add milestone', onClick: () => setAddingMilestone(true) } : null}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredMilestones.map(m => (
              <MilestoneRow key={m.id} milestone={m}
                onEdit={() => setEditingMilestoneId(m.id)}
                onDelete={() => deleteMilestone(m.id)}
                onStatusChange={(status) => updateMilestone(m.id, { status })} />
            ))}
          </div>
        )
      )}

      {activeTab === 'risks' && (
        filteredRisks.length === 0 ? (
          <Empty
            icon={Flag} title={data.risks.length === 0 ? "No risks logged" : "No matches"}
            body={data.risks.length === 0 ? "Capture things that could derail delivery so you can act early." : "Try a different search."}
            action={data.risks.length === 0 ? { label: 'Log risk', onClick: () => setAddingRisk(true) } : null}
          />
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filteredRisks.map(r => (
              <RiskCard key={r.id} risk={r}
                onEdit={() => setEditingRiskId(r.id)}
                onDelete={() => deleteRisk(r.id)}
                onStatusChange={(status) => updateRisk(r.id, { status })} />
            ))}
          </div>
        )
      )}

      {(addingMilestone || editingMilestoneId) && (
        <MilestoneFormModal
          existing={editingMilestoneId ? data.milestones.find(m => m.id === editingMilestoneId) : null}
          projectOptions={projectOptions}
          onSave={saveMilestone}
          onClose={() => { setAddingMilestone(false); setEditingMilestoneId(null); }}
        />
      )}

      {(addingRisk || editingRiskId) && (
        <RiskFormModal
          existing={editingRiskId ? data.risks.find(r => r.id === editingRiskId) : null}
          projectOptions={projectOptions}
          onSave={saveRisk}
          onClose={() => { setAddingRisk(false); setEditingRiskId(null); }}
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
      }}>{toast.message}</div>
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

function ProjectCard({ entry }) {
  const healthMap = {
    green: { color: '#22c55e', label: 'On track' },
    amber: { color: '#f59e0b', label: 'Watch' },
    red:   { color: '#ef4444', label: 'At risk' },
  };
  const h = healthMap[entry.health] || healthMap.green;
  return (
    <div style={{
      padding: 16, borderRadius: 14,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `4px solid ${h.color}`,
      display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{entry.project}</div>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          backgroundColor: `color-mix(in srgb, ${h.color} 14%, transparent)`,
          color: h.color, textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>{h.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <Stat label="Open" value={entry.open} />
        <Stat label="Overdue" value={entry.overdue} accent={entry.overdue > 0 ? '#ef4444' : undefined} />
        <Stat label="Critical" value={entry.critical} accent={entry.critical > 0 ? '#dc2626' : undefined} />
        <Stat label="High" value={entry.high} accent={entry.high > 0 ? '#ea580c' : undefined} />
      </div>

      {entry.topAssignees.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--color-border-light)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={11} /> Top load
          </div>
          {entry.topAssignees.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <span style={{ flex: 1, color: 'var(--color-text-main)', fontWeight: 600 }}>{capitalizeName(a.name)}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{a.count} open</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8,
      backgroundColor: 'var(--color-bg-body)',
      display: 'flex', flexDirection: 'column', gap: 2
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: accent || 'var(--color-text-main)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function MilestoneRow({ milestone, onEdit, onDelete, onStatusChange }) {
  const meta = M_STATUS_META[milestone.status] || M_STATUS_META.planned;
  const days = daysBetween(milestone.dueDate);
  const isOverdue = days !== null && days < 0 && milestone.status !== 'done';
  const isSoon = days !== null && days >= 0 && days <= 7 && milestone.status !== 'done';

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `4px solid ${meta.color}`,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap'
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{milestone.title}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
          {milestone.project && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Folder size={11} /> {milestone.project}</span>}
          {milestone.dueDate && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: isOverdue ? '#ef4444' : isSoon ? '#f59e0b' : 'var(--color-text-muted)',
              fontWeight: isOverdue || isSoon ? 700 : 500
            }}>
              <Calendar size={11} />
              {isOverdue ? `Overdue · ${formatDate(milestone.dueDate)}` : `Due ${formatDate(milestone.dueDate)}`}
            </span>
          )}
        </div>
        {milestone.notes && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>{milestone.notes}</div>
        )}
      </div>
      <InlineSelect value={milestone.status} options={M_STATUS_ORDER.map(k => ({ k, ...M_STATUS_META[k] }))} onChange={onStatusChange} />
      <div style={{ display: 'flex', gap: 2 }}>
        <IconButton title="Edit" onClick={onEdit}><Edit3 size={13} color="var(--color-text-light)" /></IconButton>
        <IconButton title="Delete" onClick={onDelete}><Trash2 size={13} color="var(--color-text-light)" /></IconButton>
      </div>
    </div>
  );
}

function RiskCard({ risk, onEdit, onDelete, onStatusChange }) {
  const sev = SEVERITY_META[risk.severity] || SEVERITY_META.medium;
  const stat = R_STATUS_META[risk.status] || R_STATUS_META.open;

  return (
    <div style={{
      padding: 16, borderRadius: 14,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `4px solid ${sev.color}`,
      display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{risk.title}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ color: sev.color }}>{sev.label} severity</span>
            {risk.project && <span style={{ color: 'var(--color-text-muted)' }}>· {risk.project}</span>}
          </div>
        </div>
        <InlineSelect value={risk.status} options={R_STATUS_ORDER.map(k => ({ k, ...R_STATUS_META[k] }))} onChange={onStatusChange} />
      </div>

      {risk.mitigation && (
        <div style={{
          padding: '8px 10px', borderRadius: 8, backgroundColor: 'var(--color-bg-body)',
          fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5
        }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>Mitigation:</span> {risk.mitigation}
        </div>
      )}

      {risk.notes && (
        <div style={{
          fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>{risk.notes}</div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 'auto', paddingTop: 10,
        borderTop: '1px solid var(--color-border-light)',
        fontSize: '0.7rem', color: 'var(--color-text-muted)'
      }}>
        <span>{formatDate(risk.updatedAt || risk.createdAt)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <IconButton title="Edit" onClick={onEdit}><Edit3 size={13} color="var(--color-text-light)" /></IconButton>
          <IconButton title="Delete" onClick={onDelete}><Trash2 size={13} color="var(--color-text-light)" /></IconButton>
        </div>
      </div>
    </div>
  );
}

function InlineSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = options.find(o => o.k === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 6px', borderRadius: 6,
          border: 'none', background: 'transparent',
          color: 'var(--color-text-main)',
          fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', outline: 'none'
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
          {options.map(o => {
            const active = value === o.k;
            return (
              <button key={o.k} type="button" onClick={() => { onChange(o.k); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: active ? 'var(--color-bg-body)' : 'transparent',
                  color: 'var(--color-text-main)',
                  fontSize: '0.82rem', fontWeight: active ? 600 : 500, textAlign: 'left'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: o.color }} />
                {o.label}
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
    <button title={title} onClick={onClick}
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

function Empty({ icon: Icon, title, body, action }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 20px',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: 14, border: '1px dashed var(--color-border)'
    }}>
      <Icon size={32} color="var(--color-text-light)" style={{ marginBottom: 12 }} />
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.5 }}>{body}</p>
      {action && (
        <button onClick={action.onClick} className="topbar-pill primary" style={{ display: 'inline-flex' }}>
          <Plus size={14} strokeWidth={2.2} /> {action.label}
        </button>
      )}
    </div>
  );
}

function MilestoneFormModal({ existing, projectOptions, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    title: existing?.title || '',
    project: existing?.project || (projectOptions?.[0] || ''),
    dueDate: existing?.dueDate ? String(existing.dueDate).slice(0, 10) : '',
    status: existing?.status || 'planned',
    notes: existing?.notes || '',
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
    onSave({
      title: form.title.trim(),
      project: form.project,
      dueDate: form.dueDate || null,
      status: form.status,
      notes: form.notes.trim(),
    });
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)',
    fontSize: '0.9rem', outline: 'none', color: 'var(--color-text-main)', fontFamily: 'inherit'
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{existing ? 'Edit milestone' : 'Add milestone'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title *">
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Beta release" autoFocus required style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Project">
              {projectOptions && projectOptions.length > 0 ? (
                <select value={form.project} onChange={e => set('project', e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input value={form.project} onChange={e => set('project', e.target.value)} placeholder="Project" style={inputStyle} />
              )}
            </Field>
            <Field label="Due date">
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <Field label="Status">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {M_STATUS_ORDER.map(k => {
                const meta = M_STATUS_META[k];
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
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Acceptance criteria, blockers…" style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!form.title.trim()} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 700, cursor: form.title.trim() ? 'pointer' : 'not-allowed', opacity: form.title.trim() ? 1 : 0.5 }}>{existing ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RiskFormModal({ existing, projectOptions, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    title: existing?.title || '',
    project: existing?.project || (projectOptions?.[0] || ''),
    severity: existing?.severity || 'medium',
    status: existing?.status || 'open',
    mitigation: existing?.mitigation || '',
    notes: existing?.notes || '',
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
    onSave({
      title: form.title.trim(),
      project: form.project,
      severity: form.severity,
      status: form.status,
      mitigation: form.mitigation.trim(),
      notes: form.notes.trim(),
    });
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)',
    fontSize: '0.9rem', outline: 'none', color: 'var(--color-text-main)', fontFamily: 'inherit'
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{existing ? 'Edit risk' : 'Log a risk'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title *">
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Vendor delay on payment integration" autoFocus required style={inputStyle} />
          </Field>
          <Field label="Project">
            {projectOptions && projectOptions.length > 0 ? (
              <select value={form.project} onChange={e => set('project', e.target.value)} style={inputStyle}>
                <option value="">— None —</option>
                {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input value={form.project} onChange={e => set('project', e.target.value)} placeholder="Project" style={inputStyle} />
            )}
          </Field>
          <Field label="Severity">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SEVERITY_ORDER.map(k => {
                const meta = SEVERITY_META[k];
                const active = form.severity === k;
                return (
                  <button key={k} type="button" onClick={() => set('severity', k)}
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
              {R_STATUS_ORDER.map(k => {
                const meta = R_STATUS_META[k];
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
          <Field label="Mitigation">
            <textarea value={form.mitigation} onChange={e => set('mitigation', e.target.value)} placeholder="What you'll do to reduce or avoid this risk…" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Context, dependencies, owners…" style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!form.title.trim()} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 700, cursor: form.title.trim() ? 'pointer' : 'not-allowed', opacity: form.title.trim() ? 1 : 0.5 }}>{existing ? 'Save' : 'Log risk'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </label>
  );
}
