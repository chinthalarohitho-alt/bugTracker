"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Edit3, Trash2, X, ChevronDown, Check,
  FlaskConical, GitPullRequest, CheckCircle2, AlertTriangle,
  Bug, Folder, FileText, ExternalLink, Layers
} from 'lucide-react';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import { useBugDrawer } from '../components/BugDrawerProvider';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';


const PROJECT_MODULES = {
  "Pharmacy ERP": [
    "Dashboard",
    "Sales",
    " - Sales Entry", " - B2B Sales", " - Sales Summary", " - Sales Returns", " - Sales Drafts", " - Sales Ledger", " - Sales Receipt", " - Delivery Challan",
    "Purchase",
    " - Purchase Entry", " - Purchase Summary", " - Purchase Ledger", " - Purchase Returns", " - Payment", " - Purchase Draft", " - OCR Scan", " - OCR Draft",
    "Item Master",
    "Quarantined/Expired Drugs",
    "Reports",
    " - Sales Reports", " - Purchase Reports", " - Stock Reports",
    "Expenses",
    "Cash and Bank",
    " - Payment Accounts", " - Contra",
    "Settings"
  ]
};

const getModulesForProject = (project) =>
  PROJECT_MODULES[project] || ["General", "Authentication", "Database", "UI/UX", "API"];

const cleanModuleLabel = (mod) => (mod || '').startsWith(' -') ? mod.substring(2).trim() : mod;

async function apiCall(method, body) {
  const res = await fetch('/api/qa-hub', {
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

const shortId = (id) => {
  if (!id) return 'BUG-X';
  if (String(id).startsWith('BUG-')) return id;
  const seg = String(id).split('-')[0] || 'X';
  return `BUG-${seg.substring(0, 4).toUpperCase()}`;
};

export default function QAHubPage() {
  const { currentReporter, globalBugs, globalSettings } = useAuth();
  const { openBug } = useBugDrawer();
  const projectOptions = useMemo(
    () => (globalSettings?.projects || []).filter(Boolean),
    [globalSettings]
  );

  const [testCases, setTestCases] = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // queue | cases
  const [search, setSearch] = useState('');
  const [casesProject, setCasesProject] = useState('');
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [addingCase, setAddingCase] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  useEffect(() => {
    if (typeof window === 'undefined' || !currentReporter) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/qa-hub?owner=${encodeURIComponent(currentReporter)}`);
        const json = await res.json();
        if (!cancelled) {
          setTestCases(Array.isArray(json.testCases) ? json.testCases : []);
        }
      } catch (err) {
        console.error('qa-hub load failed:', err);
        if (!cancelled) setTestCases([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentReporter]);

  useEffect(() => {
    if (!casesProject && projectOptions.length > 0) setCasesProject(projectOptions[0]);
  }, [projectOptions, casesProject]);

  const showToast = (message) => {
    if (typeof window !== 'undefined' && window.__qaToastTimer) clearTimeout(window.__qaToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__qaToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  };

  const safeApi = async (method, body, label) => {
    try { await apiCall(method, body); }
    catch (err) { console.error('qa-hub', method, err); showToast(`${label}: ${err.message}`); }
  };

  // Bugs in QA's flow
  const bugInsights = useMemo(() => {
    const bugs = Array.isArray(globalBugs) ? globalBugs : [];
    const closedSet = new Set(['Resolved', 'Closed']);
    const filedByMe = bugs.filter(b => toName(b.reporter) === currentReporter);
    const reviewPR = bugs.filter(b => b.status === 'In PR');
    const verifying = bugs.filter(b => b.status === 'In Testing');
    const open = bugs.filter(b => b.status === 'Open' || b.status === 'ReOpen');

    const weekAgo = Date.now() - 7 * 86400000;
    const closedByMeThisWeek = bugs.filter(b => closedSet.has(b.status) &&
      toName(b.reporter) === currentReporter &&
      new Date(b.updatedAt || b.createdAt).getTime() >= weekAgo).length;

    return {
      filedByMe: filedByMe.length,
      filedByMeOpen: filedByMe.filter(b => !closedSet.has(b.status)).length,
      reviewPR, verifying, open,
      closedByMeThisWeek,
    };
  }, [globalBugs, currentReporter]);

  const queueBugs = useMemo(() => {
    const list = [...bugInsights.reviewPR, ...bugInsights.verifying, ...bugInsights.open];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q) ||
      (b.project || '').toLowerCase().includes(q) ||
      toName(b.assignee).toLowerCase().includes(q)
    );
  }, [bugInsights, search]);


  // === Test Cases ===
  const projectCases = useMemo(() => {
    if (!testCases || !casesProject) return [];
    let list = testCases.filter(c => c.project === casesProject);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.url || '').toLowerCase().includes(q) ||
        (c.module || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [testCases, casesProject, search]);

  const casesByModule = useMemo(() => {
    const grouped = new Map();
    projectCases.forEach(c => {
      const key = c.module || 'Unassigned';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(c);
    });
    const moduleOrder = getModulesForProject(casesProject);
    const ordered = [];
    moduleOrder.forEach(m => { if (grouped.has(m)) { ordered.push([m, grouped.get(m)]); grouped.delete(m); } });
    [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(e => ordered.push(e));
    return ordered;
  }, [projectCases, casesProject]);

  const updateCase = (id, changes) => {
    setTestCases(prev => (prev || []).map(c => c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c));
    safeApi('PUT', { owner: currentReporter, kind: 'test_case', id, changes }, 'Update failed');
  };

  const deleteCase = (id) => {
    const t = (testCases || []).find(c => c.id === id);
    setTestCases(prev => (prev || []).filter(c => c.id !== id));
    if (t) showToast(`Removed "${t.title}"`);
    safeApi('DELETE', { owner: currentReporter, kind: 'test_case', id }, 'Delete failed');
  };

  const saveCase = (formData) => {
    if (editingCaseId) {
      updateCase(editingCaseId, formData);
      showToast('Updated');
      setEditingCaseId(null);
    } else {
      const item = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...formData,
      };
      setTestCases(prev => [...(prev || []), item]);
      safeApi('POST', { owner: currentReporter, kind: 'test_case', payload: item }, 'Save failed');
      showToast('Test case added');
      setAddingCase(false);
    }
  };

  if (testCases === null) {
    return <LoadingOverlay message="Loading QA Hub" subtext="Fetching queue and test cases..." />;
  }

  return (
    <main style={{ width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      <PageHeader
        context="Quality"
        title="QA Hub"
        subtitle="Your testing queue and manual test cases."
        actions={
          activeTab === 'cases' ? (
            <button onClick={() => setAddingCase(true)} className="topbar-pill primary">
              <Plus size={15} strokeWidth={2.2} /> Add Test Case
            </button>
          ) : null
        }
      />

      <div style={{
        display: 'grid', gap: 12, marginBottom: 22,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
      }}>
        <Kpi
          icon={GitPullRequest} color="#8b5cf6"
          label="Review PR"
          value={bugInsights.reviewPR.length}
          sub="Dev raised — review"
        />
        <Kpi
          icon={FlaskConical} color="#06b6d4"
          label="Verify on dev"
          value={bugInsights.verifying.length}
          sub="Deployed — verify fix"
        />
        <Kpi
          icon={Bug} color="#3b82f6"
          label="Filed by me"
          value={bugInsights.filedByMe}
          sub={`${bugInsights.filedByMeOpen} still open`}
        />
        <Kpi
          icon={CheckCircle2} color="#22c55e"
          label="Closed (7d)"
          value={bugInsights.closedByMeThisWeek}
          sub="By me, this week"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 18 }}>
        {[
          { k: 'queue', label: 'My Queue',   count: bugInsights.reviewPR.length + bugInsights.verifying.length + bugInsights.open.length },
          { k: 'cases', label: 'Test Cases', count: testCases.length },
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

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        {activeTab === 'cases' && projectOptions.length > 0 && (
          <PillSelect
            value={casesProject}
            options={projectOptions.map(p => ({ value: p, label: p }))}
            onChange={setCasesProject}
            icon={Folder}
          />
        )}
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              activeTab === 'queue' ? 'Search bugs by id, title, project…' :
              'Search test cases by title, module, tags…'
            }
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

      {activeTab === 'queue' && (
        queueBugs.length === 0 ? (
          <Empty icon={CheckCircle2} title="Nothing to test"
            body="No bugs in PR review, verification, or open. Clean queue!" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queueBugs.map(b => (
              <BugQueueRow key={b.id} bug={b} onOpen={() => openBug(b)} />
            ))}
          </div>
        )
      )}

      {activeTab === 'cases' && (
        casesByModule.length === 0 ? (
          <Empty icon={FileText}
            title={projectCases.length === 0 ? `No test cases for ${casesProject || 'this project'}` : "No matches"}
            body={projectCases.length === 0 ? "Add manual test case docs (Notion, Google Docs, Confluence) and group them by module." : "Try a different search term."}
            action={projectCases.length === 0 && casesProject ? { label: 'Add test case', onClick: () => setAddingCase(true) } : null} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {casesByModule.map(([module, list]) => (
              <ModuleSection key={module} module={module} cases={list}
                onEdit={(id) => setEditingCaseId(id)}
                onDelete={(id) => deleteCase(id)} />
            ))}
          </div>
        )
      )}

      {(addingCase || editingCaseId) && (
        <TestCaseFormModal
          existing={editingCaseId ? testCases.find(c => c.id === editingCaseId) : null}
          defaultProject={casesProject}
          projectOptions={projectOptions}
          onSave={saveCase}
          onClose={() => { setAddingCase(false); setEditingCaseId(null); }}
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

function BugQueueRow({ bug, onOpen }) {
  const statusMeta = {
    'In PR':      { color: '#8b5cf6', icon: GitPullRequest },
    'In Testing': { color: '#06b6d4', icon: FlaskConical },
    'Open':       { color: '#3b82f6', icon: Bug },
    'ReOpen':     { color: '#ef4444', icon: AlertTriangle },
  }[bug.status] || { color: '#64748b', icon: Bug };
  const StatusIcon = statusMeta.icon;

  return (
    <div onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 12,
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${statusMeta.color}`,
        cursor: 'pointer'
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = statusMeta.color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.borderLeft = `4px solid ${statusMeta.color}`; }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        backgroundColor: `color-mix(in srgb, ${statusMeta.color} 14%, transparent)`,
        color: statusMeta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <StatusIcon size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{shortId(bug.id)}</span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6,
            backgroundColor: `color-mix(in srgb, ${statusMeta.color} 14%, transparent)`,
            color: statusMeta.color, textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>{bug.status}</span>
          {bug.priority && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase'
            }}>{bug.priority}</span>
          )}
        </div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bug.title}</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
        <div>{bug.project || 'General'}</div>
        <div style={{ fontWeight: 600, color: 'var(--color-text-main)', marginTop: 2 }}>{capitalizeName(toName(bug.assignee)) || '—'}</div>
      </div>
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

function ModuleSection({ module, cases, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  const cleanLabel = cleanModuleLabel(module);
  return (
    <div style={{
      borderRadius: 12,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      overflow: 'hidden'
    }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', border: 'none', cursor: 'pointer',
          backgroundColor: 'transparent', textAlign: 'left'
        }}>
        <Layers size={14} color="var(--color-primary)" />
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{cleanLabel}</span>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)',
          padding: '2px 8px', borderRadius: 999, backgroundColor: 'var(--color-bg-body)'
        }}>{cases.length}</span>
        <ChevronDown size={14} color="var(--color-text-muted)" style={{
          marginLeft: 'auto',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.15s'
        }} />
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border-light)' }}>
          {cases.map(c => <TestCaseRow key={c.id} testCase={c} onEdit={() => onEdit(c.id)} onDelete={() => onDelete(c.id)} />)}
        </div>
      )}
    </div>
  );
}

function TestCaseRow({ testCase, onEdit, onDelete }) {
  const formatUrl = (u) => (u && (u.startsWith('http://') || u.startsWith('https://'))) ? u : `https://${u || ''}`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      borderBottom: '1px solid var(--color-border-light)'
    }}>
      <FileText size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-main)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>{testCase.title}</div>
        {testCase.notes && (
          <div style={{
            fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{testCase.notes}</div>
        )}
      </div>
      {testCase.tags && testCase.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
          {testCase.tags.slice(0, 3).map(t => (
            <span key={t} style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-muted)'
            }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {testCase.url && (
          <a href={formatUrl(testCase.url)} target="_blank" rel="noopener noreferrer" title="Open"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              backgroundColor: 'transparent', color: 'var(--color-primary)', textDecoration: 'none'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <ExternalLink size={13} />
          </a>
        )}
        <IconButton title="Edit" onClick={onEdit}><Edit3 size={13} color="var(--color-text-light)" /></IconButton>
        <IconButton title="Delete" onClick={onDelete}><Trash2 size={13} color="var(--color-text-light)" /></IconButton>
      </div>
    </div>
  );
}

function TestCaseFormModal({ existing, defaultProject, projectOptions, onSave, onClose }) {
  const initialProject = existing?.project || defaultProject || (projectOptions?.[0] || '');
  const [form, setForm] = useState(() => ({
    title: existing?.title || '',
    project: initialProject,
    module: existing?.module || (getModulesForProject(initialProject)[0] || ''),
    url: existing?.url || '',
    notes: existing?.notes || '',
    tagsText: (existing?.tags || []).join(', '),
  }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setProject = (v) => setForm(f => ({ ...f, project: v, module: getModulesForProject(v)[0] || '' }));

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsText.split(',').map(t => t.trim()).filter(Boolean);
    const url = form.url.trim();
    const formatted = url && !url.startsWith('http') ? `https://${url}` : url;
    onSave({
      title: form.title.trim(),
      project: form.project,
      module: form.module,
      url: formatted,
      notes: form.notes.trim(),
      tags,
    });
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)',
    fontSize: '0.9rem', outline: 'none', color: 'var(--color-text-main)', fontFamily: 'inherit'
  };
  const moduleOptions = getModulesForProject(form.project);

  return (
    <div className="modal-overlay" style={{ zIndex: 9000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {existing ? 'Edit test case' : 'Add test case'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title *">
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Sales entry — happy path" autoFocus required style={inputStyle} />
          </Field>
          <Field label="Doc URL">
            <input value={form.url} onChange={e => set('url', e.target.value)}
              placeholder="https://docs.google.com/… or notion.so/…" style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Project">
              {projectOptions && projectOptions.length > 0 ? (
                <FormSelect
                  value={form.project}
                  options={projectOptions.map(p => ({ value: p, label: p }))}
                  onChange={(v) => setProject(v)}
                />
              ) : (
                <input value={form.project} onChange={e => setProject(e.target.value)} placeholder="Project" style={inputStyle} />
              )}
            </Field>
            <Field label="Module">
              <FormSelect
                value={form.module}
                options={moduleOptions.map(m => ({
                  value: m,
                  label: cleanModuleLabel(m),
                  indent: m.startsWith(' -')
                }))}
                onChange={(v) => set('module', v)}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="What this covers, prerequisites…"
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          </Field>
          <Field label="Tags (comma separated)">
            <input value={form.tagsText} onChange={e => set('tagsText', e.target.value)}
              placeholder="smoke, regression, edge" style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer'
            }}>Cancel</button>
            <button type="submit" disabled={!form.title.trim()} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
              backgroundColor: '#0f172a', color: 'white', fontWeight: 700,
              cursor: form.title.trim() ? 'pointer' : 'not-allowed',
              opacity: form.title.trim() ? 1 : 0.5
            }}>{existing ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PillSelect({ value, options, onChange, icon: Icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 36, padding: '0 14px', borderRadius: 999,
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
          color: 'var(--color-text-main)',
          fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', outline: 'none'
        }}>
        {Icon && <Icon size={14} color="var(--color-text-muted)" />}
        {selected?.label || 'Select…'}
        <ChevronDown size={13} color="var(--color-text-muted)"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: '100%', maxHeight: 280, overflowY: 'auto',
          backgroundColor: 'var(--chrome-bg-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          boxShadow: '0 12px 28px -8px rgba(0,0,0,0.18)',
          padding: 4, zIndex: 200, whiteSpace: 'nowrap'
        }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                  fontSize: '0.85rem', fontWeight: active ? 600 : 500, textAlign: 'left'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                {o.label}
                {active && <Check size={13} color="var(--color-primary)" strokeWidth={3} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormSelect({ value, options, onChange, placeholder = 'Select…' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '10px 14px', borderRadius: 10,
          border: '1px solid ' + (open ? 'var(--color-text-main)' : 'var(--color-border)'),
          backgroundColor: 'var(--color-bg-surface)',
          fontSize: '0.9rem', fontWeight: 500,
          color: selected ? 'var(--color-text-main)' : 'var(--color-text-light)',
          cursor: 'pointer', outline: 'none', textAlign: 'left',
          fontFamily: 'inherit'
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} color="var(--color-text-muted)"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          maxHeight: 280, overflowY: 'auto',
          backgroundColor: 'var(--chrome-bg-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          boxShadow: '0 12px 28px -8px rgba(0,0,0,0.18)',
          padding: 4, zIndex: 200
        }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px',
                  paddingLeft: o.indent ? 28 : 12,
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-main)',
                  fontSize: '0.85rem', fontWeight: active ? 600 : 500, textAlign: 'left'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                {o.indent && <span style={{ color: 'var(--color-text-light)', fontSize: '0.7rem', marginRight: -4 }}>↳</span>}
                {o.label}
                {active && <Check size={13} color="var(--color-primary)" strokeWidth={3} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>
      )}
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
