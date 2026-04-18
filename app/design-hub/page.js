"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Pin, Trash2, Edit3, ExternalLink,
  Frame, FileText, Sparkles, Link2, X, Folder, ChevronDown, Check, Tag
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';

const TYPE_META = {
  figma:       { label: 'Figma',       color: '#a855f7', Icon: Frame },
  doc:         { label: 'Docs',        color: '#0ea5e9', Icon: FileText },
  inspiration: { label: 'Inspiration', color: '#ec4899', Icon: Sparkles },
  other:       { label: 'Link',        color: '#64748b', Icon: Link2 },
};

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'figma',       label: 'Figma' },
  { key: 'doc',         label: 'Docs' },
  { key: 'inspiration', label: 'Inspiration' },
  { key: 'other',       label: 'Other' },
];

function detectType(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('figma.com')) return 'figma';
  if (u.includes('docs.google.com') || u.includes('notion.so') || u.includes('notion.site') || u.includes('confluence') || u.includes('coda.io')) return 'doc';
  if (u.includes('dribbble.com') || u.includes('behance.net') || u.includes('pinterest.') || u.includes('mobbin.com') || u.includes('awwwards.com')) return 'inspiration';
  return 'other';
}

function storageKey(user) {
  return `design_hub_${user || 'guest'}`;
}

const apiCall = (method, body) =>
  fetch('/api/design-hub', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(err => console.error('design-hub API error:', err));

function stripUrl(url) {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url;
  }
}

function deriveTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg).replace(/[-_]/g, ' ');
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function DesignHubPage() {
  const { currentReporter, globalSettings } = useAuth();
  const projectOptions = useMemo(
    () => (globalSettings?.projects || []).filter(Boolean),
    [globalSettings]
  );
  const [resources, setResources] = useState(null);
  const [quickUrl, setQuickUrl] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [tagFilter, setTagFilter] = useState([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  useEffect(() => {
    if (typeof window === 'undefined' || !currentReporter) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/design-hub?owner=${encodeURIComponent(currentReporter)}`);
        const data = await res.json();
        if (cancelled) return;
        const serverResources = Array.isArray(data.resources) ? data.resources : [];

        // One-time migration: if server is empty but localStorage has data, push it up.
        let local = [];
        try {
          const raw = localStorage.getItem(storageKey(currentReporter));
          if (raw) local = JSON.parse(raw);
        } catch {}
        if (serverResources.length === 0 && local.length > 0) {
          await apiCall('POST', { owner: currentReporter, resources: local });
          localStorage.removeItem(storageKey(currentReporter));
          setResources(local);
        } else {
          setResources(serverResources);
          if (local.length > 0) localStorage.removeItem(storageKey(currentReporter));
        }
      } catch (err) {
        console.error('design-hub load failed:', err);
        if (!cancelled) setResources([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentReporter]);

  const showToast = (message) => {
    if (typeof window !== 'undefined' && window.__hubToastTimer) clearTimeout(window.__hubToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__hubToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  };

  const filtered = useMemo(() => {
    if (!resources) return [];
    let list = resources;
    if (filter !== 'all') list = list.filter(r => r.type === filter);
    if (projectFilter.length > 0) {
      list = list.filter(r => (r.projects || []).some(p => projectFilter.includes(p)));
    }
    if (tagFilter.length > 0) {
      list = list.filter(r => (r.tags || []).some(t => tagFilter.includes(t)));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.url || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (r.projects || []).some(p => p.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [resources, filter, projectFilter, tagFilter, search]);

  const tagOptions = useMemo(() => {
    if (!resources) return [];
    const set = new Set();
    resources.forEach(r => (r.tags || []).forEach(t => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [resources]);

  const counts = useMemo(() => {
    const base = { all: 0, figma: 0, doc: 0, inspiration: 0, other: 0 };
    if (!resources) return base;
    base.all = resources.length;
    resources.forEach(r => { base[r.type] = (base[r.type] || 0) + 1; });
    return base;
  }, [resources]);

  const addQuick = () => {
    const url = quickUrl.trim();
    if (!url) return;
    const formatted = url.startsWith('http') ? url : `https://${url}`;
    const item = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: deriveTitleFromUrl(formatted),
      url: formatted,
      type: detectType(formatted),
      notes: '',
      tags: [],
      projects: [],
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    setResources(prev => [item, ...(prev || [])]);
    setQuickUrl('');
    setEditingId(item.id);
    showToast('Saved — add details below');
    apiCall('POST', { owner: currentReporter, resource: item });
  };

  const updateResource = (id, changes, { sync = true } = {}) => {
    setResources(prev => (prev || []).map(r => r.id === id ? { ...r, ...changes } : r));
    if (sync) apiCall('PUT', { owner: currentReporter, id, changes });
  };

  const deleteResource = (id) => {
    const target = (resources || []).find(r => r.id === id);
    setResources(prev => (prev || []).filter(r => r.id !== id));
    if (target) showToast(`Removed "${target.title}"`);
    apiCall('DELETE', { owner: currentReporter, id });
  };

  const togglePin = (id) => {
    const next = !(resources || []).find(r => r.id === id)?.pinned;
    updateResource(id, { pinned: next });
  };

  const openLink = (r) => {
    updateResource(r.id, { lastAccessedAt: new Date().toISOString() });
    if (typeof window !== 'undefined') window.open(r.url, '_blank', 'noopener,noreferrer');
  };

  if (resources === null) {
    return <LoadingOverlay message="Loading Design Hub" subtext="Fetching your saved resources..." />;
  }

  const hasFilter = filter !== 'all' || projectFilter.length > 0 || tagFilter.length > 0 || search.trim().length > 0;

  const toggleProjectFilter = (p) => {
    setProjectFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const toggleTagFilter = (t) => {
    setTagFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <main style={{ width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      <PageHeader
        context="Design"
        title="Design Hub"
        subtitle="Bookmarks, design files, and references — all in one place."
        actions={
          <button onClick={() => setAdding(true)} className="topbar-pill primary">
            <Plus size={15} strokeWidth={2.2} /> Add Resource
          </button>
        }
      />

      <div style={{
        display: 'flex', gap: 10, padding: 12, marginBottom: 24,
        backgroundColor: 'var(--color-bg-surface)', borderRadius: 14,
        border: '1px solid var(--color-border)', alignItems: 'center'
      }}>
        <Link2 size={17} color="var(--color-text-muted)" style={{ marginLeft: 8 }} />
        <input
          value={quickUrl}
          onChange={e => setQuickUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addQuick(); }}
          placeholder="Paste a Figma, Notion, Google Docs, or any URL — press Enter"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: '0.9rem', padding: '8px 0',
            color: 'var(--color-text-main)'
          }}
        />
        <button
          onClick={addQuick}
          disabled={!quickUrl.trim()}
          style={{
            padding: '8px 18px', borderRadius: 8,
            backgroundColor: quickUrl.trim() ? '#0f172a' : 'var(--color-bg-body)',
            color: quickUrl.trim() ? 'white' : 'var(--color-text-light)',
            border: 'none', fontWeight: 700, fontSize: '0.85rem',
            cursor: quickUrl.trim() ? 'pointer' : 'not-allowed'
          }}
        >Save</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '7px 14px', borderRadius: 999,
                  border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-border)'),
                  backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-surface))' : 'var(--color-bg-surface)',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6
                }}
              >
                {label} <span style={{ opacity: 0.6, fontWeight: 600 }}>{counts[key] || 0}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {projectOptions.length > 0 && (
            <ChipFilter
              icon={Folder}
              allLabel="All projects"
              pluralLabel="projects"
              options={projectOptions}
              selected={projectFilter}
              onToggle={toggleProjectFilter}
              onClear={() => setProjectFilter([])}
              open={showProjectMenu}
              setOpen={setShowProjectMenu}
            />
          )}

          {tagOptions.length > 0 && (
            <ChipFilter
              icon={Tag}
              allLabel="All tags"
              pluralLabel="tags"
              options={tagOptions}
              selected={tagFilter}
              onToggle={toggleTagFilter}
              onClear={() => setTagFilter([])}
              open={showTagMenu}
              setOpen={setShowTagMenu}
            />
          )}

          <div style={{ position: 'relative', minWidth: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, URL, notes, tags…"
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          totalCount={resources.length}
          hasFilter={hasFilter}
          onAdd={() => setAdding(true)}
        />
      ) : (
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'
        }}>
          {filtered.map(r => (
            <ResourceCard
              key={r.id}
              resource={r}
              onOpen={() => openLink(r)}
              onEdit={() => setEditingId(r.id)}
              onDelete={() => deleteResource(r.id)}
              onTogglePin={() => togglePin(r.id)}
            />
          ))}
        </div>
      )}

      {(adding || editingId) && (
        <ResourceFormModal
          existing={editingId ? resources.find(r => r.id === editingId) : null}
          projectOptions={projectOptions}
          onSave={(data) => {
            if (editingId) {
              updateResource(editingId, data);
              showToast('Updated');
            } else {
              const item = {
                id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                pinned: false,
                createdAt: new Date().toISOString(),
                ...data,
                type: data.type || detectType(data.url || ''),
              };
              setResources(prev => [item, ...(prev || [])]);
              apiCall('POST', { owner: currentReporter, resource: item });
              showToast('Added');
            }
            setAdding(false);
            setEditingId(null);
          }}
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

function ResourceCard({ resource, onOpen, onEdit, onDelete, onTogglePin }) {
  const meta = TYPE_META[resource.type] || TYPE_META.other;
  const Icon = meta.Icon;

  return (
    <div
      onClick={onOpen}
      style={{
        position: 'relative', padding: 16, borderRadius: 14,
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        transition: 'border-color 0.15s, transform 0.15s',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 10
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
          color: meta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.95rem', fontWeight: 600,
            color: 'var(--color-text-main)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{resource.title}</div>
          <div style={{
            fontSize: '0.72rem', color: 'var(--color-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 2
          }}>{stripUrl(resource.url)}</div>
        </div>
        {resource.pinned && (
          <Pin size={14} fill="#f59e0b" color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
        )}
      </div>

      {resource.notes && (
        <div style={{
          fontSize: '0.78rem', color: 'var(--color-text-muted)',
          lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>{resource.notes}</div>
      )}

      {((resource.projects && resource.projects.length > 0) || (resource.tags && resource.tags.length > 0)) && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(resource.projects || []).map(p => (
            <span key={`p-${p}`} style={{
              fontSize: '0.65rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 6,
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              color: 'var(--color-primary)',
              border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)'
            }}>{p}</span>
          ))}
          {(resource.tags || []).map(t => (
            <span key={`t-${t}`} style={{
              fontSize: '0.65rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 6,
              backgroundColor: 'var(--color-bg-body)',
              color: 'var(--color-text-muted)'
            }}>{t}</span>
          ))}
        </div>
      )}

      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 'auto', paddingTop: 10,
          borderTop: '1px solid var(--color-border-light)'
        }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
          color: meta.color, letterSpacing: '0.05em'
        }}>{meta.label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <IconButton title={resource.pinned ? 'Unpin' : 'Pin'} onClick={onTogglePin}>
            <Pin size={13} color={resource.pinned ? '#f59e0b' : 'var(--color-text-light)'} fill={resource.pinned ? '#f59e0b' : 'none'} />
          </IconButton>
          <IconButton title="Edit" onClick={onEdit}>
            <Edit3 size={13} color="var(--color-text-light)" />
          </IconButton>
          <IconButton title="Delete" onClick={onDelete}>
            <Trash2 size={13} color="var(--color-text-light)" />
          </IconButton>
          <IconButton title="Open in new tab" onClick={onOpen}>
            <ExternalLink size={13} color="var(--color-text-light)" />
          </IconButton>
        </div>
      </div>
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
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function EmptyState({ totalCount, hasFilter, onAdd }) {
  return (
    <div style={{
      textAlign: 'center', padding: '56px 20px',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: 14, border: '1px dashed var(--color-border)'
    }}>
      <Sparkles size={36} color="var(--color-text-light)" style={{ marginBottom: 14 }} />
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>
        {totalCount === 0 ? 'Your design hub is empty' : 'No matching resources'}
      </h3>
      <p style={{
        fontSize: '0.85rem', color: 'var(--color-text-muted)',
        maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.5
      }}>
        {totalCount === 0
          ? 'Save Figma files, Notion docs, inspiration boards, or any link you want to come back to.'
          : 'Try a different filter or search term.'}
      </p>
      {!hasFilter && (
        <button onClick={onAdd} className="topbar-pill primary" style={{ display: 'inline-flex' }}>
          <Plus size={14} strokeWidth={2.2} /> Add your first resource
        </button>
      )}
    </div>
  );
}

function ResourceFormModal({ existing, projectOptions = [], onSave, onClose }) {
  const [title, setTitle] = useState(existing?.title || '');
  const [url, setUrl] = useState(existing?.url || '');
  const [type, setType] = useState(existing?.type || 'other');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [tagsText, setTagsText] = useState((existing?.tags || []).join(', '));
  const [projects, setProjects] = useState(existing?.projects || []);
  const [touchedType, setTouchedType] = useState(!!existing);

  const toggleProject = (p) => {
    setProjects(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  useEffect(() => {
    if (touchedType) return;
    if (url) setType(detectType(url));
  }, [url, touchedType]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    const formatted = url.startsWith('http') ? url : `https://${url}`;
    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ title: title.trim(), url: formatted, type, notes: notes.trim(), tags, projects });
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-surface)',
    fontSize: '0.9rem', outline: 'none',
    color: 'var(--color-text-main)',
    fontFamily: 'inherit'
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {existing ? 'Edit resource' : 'Add resource'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="URL">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://figma.com/file/..."
              autoFocus
              required
              style={inputStyle}
            />
          </Field>

          <Field label="Title">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Onboarding flow"
              required
              style={inputStyle}
            />
          </Field>

          <Field label="Type">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_META).map(([k, m]) => {
                const TypeIcon = m.Icon;
                const active = type === k;
                return (
                  <button
                    key={k} type="button"
                    onClick={() => { setType(k); setTouchedType(true); }}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: '1px solid ' + (active ? m.color : 'var(--color-border)'),
                      backgroundColor: active ? `color-mix(in srgb, ${m.color} 14%, transparent)` : 'var(--color-bg-surface)',
                      color: active ? m.color : 'var(--color-text-muted)',
                      fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <TypeIcon size={13} /> {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {projectOptions.length > 0 && (
            <Field label={`Projects${projects.length ? ` · ${projects.length} selected` : ''}`}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {projectOptions.map(p => {
                  const active = projects.includes(p);
                  return (
                    <button
                      key={p} type="button"
                      onClick={() => toggleProject(p)}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-border)'),
                        backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--color-bg-surface)',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Quick context — what this is for, who owns it…"
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            />
          </Field>

          <Field label="Tags (comma separated)">
            <input
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              placeholder="onboarding, mobile, v2"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer'
            }}>Cancel</button>
            <button type="submit" disabled={!title.trim() || !url.trim()} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: 'none', backgroundColor: '#0f172a', color: 'white',
              fontWeight: 700,
              cursor: title.trim() && url.trim() ? 'pointer' : 'not-allowed',
              opacity: title.trim() && url.trim() ? 1 : 0.5
            }}>{existing ? 'Save changes' : 'Add resource'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChipFilter({ icon: Icon, allLabel, pluralLabel, options, selected, onToggle, onClear, open, setOpen }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  const active = selected.length > 0;
  const label = active
    ? (selected.length === 1 ? selected[0] : `${selected.length} ${pluralLabel}`)
    : allLabel;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 36, padding: '0 14px', borderRadius: 999,
          border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-border)'),
          backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-surface))' : 'var(--color-bg-surface)',
          color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
          fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
        }}
      >
        <Icon size={14} />
        {label}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 220, maxHeight: 320, overflowY: 'auto',
          backgroundColor: 'var(--chrome-bg-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          boxShadow: '0 12px 28px -8px rgba(0,0,0,0.18)',
          padding: 6, zIndex: 500
        }}>
          {options.map(p => {
            const isSelected = selected.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => onToggle(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
                  fontSize: '0.85rem', fontWeight: 600, textAlign: 'left'
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: '1.5px solid ' + (isSelected ? 'var(--color-primary)' : 'var(--color-border)'),
                  backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                </span>
                {p}
              </button>
            );
          })}

          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { onClear(); setOpen(false); }}
              style={{
                marginTop: 4, width: '100%', padding: '8px 12px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                backgroundColor: 'transparent',
                color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, textAlign: 'left',
                borderTop: '1px solid var(--color-border-light)'
              }}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
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
