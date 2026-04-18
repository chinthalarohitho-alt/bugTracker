"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Trash2, Edit3, Phone, Mail, MapPin, Building2,
  ChevronDown, Check, X, Briefcase, Calendar, AlertCircle,
  TrendingUp, Trophy, Users, Globe2, Filter
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';

const STAGE_META = {
  lead:        { label: 'Lead',        color: '#64748b', open: true },
  contacted:   { label: 'Contacted',   color: '#0ea5e9', open: true },
  demo:        { label: 'Demo',        color: '#8b5cf6', open: true },
  negotiation: { label: 'Negotiation', color: '#f59e0b', open: true },
  won:         { label: 'Won',         color: '#22c55e', open: false },
  lost:        { label: 'Lost',        color: '#ef4444', open: false },
};

const STAGE_ORDER = ['lead', 'contacted', 'demo', 'negotiation', 'won', 'lost'];

async function apiCall(method, body) {
  const res = await fetch('/api/sales-hub', {
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

const formatINR = (n) => {
  if (!n || isNaN(n)) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysBetween = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / 86400000);
};

const startOfQuarter = () => {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
};

export default function SalesHubPage() {
  const { currentReporter, globalSettings } = useAuth();
  const productOptions = useMemo(
    () => (globalSettings?.projects || []).filter(Boolean),
    [globalSettings]
  );

  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState([]);
  const [productFilter, setProductFilter] = useState([]);
  const [showCityMenu, setShowCityMenu] = useState(false);
  const [showProductMenu, setShowProductMenu] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  useEffect(() => {
    if (typeof window === 'undefined' || !currentReporter) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sales-hub?owner=${encodeURIComponent(currentReporter)}`);
        const data = await res.json();
        if (!cancelled) setCustomers(Array.isArray(data.customers) ? data.customers : []);
      } catch (err) {
        console.error('sales-hub load failed:', err);
        if (!cancelled) setCustomers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentReporter]);

  const showToast = (message) => {
    if (typeof window !== 'undefined' && window.__salesToastTimer) clearTimeout(window.__salesToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__salesToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  };

  const safeApi = async (method, body, errorLabel) => {
    try {
      await apiCall(method, body);
    } catch (err) {
      console.error('sales-hub', method, err);
      showToast(`${errorLabel}: ${err.message}`);
    }
  };

  const cityOptions = useMemo(() => {
    if (!customers) return [];
    return [...new Set(customers.map(c => c.city).filter(Boolean))].sort();
  }, [customers]);

  const insights = useMemo(() => {
    const list = customers || [];
    const open = list.filter(c => STAGE_META[c.stage]?.open);
    const won = list.filter(c => c.stage === 'won');
    const qStart = startOfQuarter();
    const wonThisQ = won.filter(c => new Date(c.updatedAt || c.createdAt) >= qStart);
    const wonThisQValue = wonThisQ.reduce((n, c) => n + (Number(c.estimatedValue) || 0), 0);
    const pipelineValue = open.reduce((n, c) => n + (Number(c.estimatedValue) || 0), 0);
    const cities = new Set(list.map(c => c.city).filter(Boolean));
    const states = new Set(list.map(c => c.state).filter(Boolean));
    const overdue = open.filter(c => c.nextFollowUpAt && new Date(c.nextFollowUpAt) < new Date());
    const stageCounts = STAGE_ORDER.reduce((acc, s) => {
      acc[s] = list.filter(c => c.stage === s).length;
      return acc;
    }, {});
    return {
      total: list.length,
      open: open.length,
      pipelineValue,
      wonCount: wonThisQ.length,
      wonValue: wonThisQValue,
      cities: cities.size,
      states: states.size,
      overdue: overdue.length,
      stageCounts,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    if (!customers) return [];
    let list = customers;
    if (stageFilter !== 'all') {
      if (stageFilter === 'open') list = list.filter(c => STAGE_META[c.stage]?.open);
      else list = list.filter(c => c.stage === stageFilter);
    }
    if (cityFilter.length > 0) list = list.filter(c => cityFilter.includes(c.city));
    if (productFilter.length > 0) list = list.filter(c => productFilter.includes(c.product));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.contactPerson || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.state || '').toLowerCase().includes(q) ||
        (c.product || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const aDue = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
      const bDue = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
  }, [customers, stageFilter, cityFilter, productFilter, search]);

  const updateCustomer = (id, changes, { sync = true } = {}) => {
    setCustomers(prev => (prev || []).map(c => c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c));
    if (sync) safeApi('PUT', { owner: currentReporter, id, changes }, 'Update failed');
  };

  const deleteCustomer = (id) => {
    const target = (customers || []).find(c => c.id === id);
    setCustomers(prev => (prev || []).filter(c => c.id !== id));
    if (target) showToast(`Removed ${target.name}`);
    safeApi('DELETE', { owner: currentReporter, id }, 'Delete failed');
  };

  const saveCustomer = (data) => {
    if (editingId) {
      updateCustomer(editingId, data);
      showToast('Updated');
    } else {
      const item = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      setCustomers(prev => [item, ...(prev || [])]);
      safeApi('POST', { owner: currentReporter, customer: item }, 'Save failed');
      showToast('Customer added');
    }
    setAdding(false);
    setEditingId(null);
  };

  const toggleCity = (c) => setCityFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleProduct = (p) => setProductFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  if (customers === null) {
    return <LoadingOverlay message="Loading Sales Hub" subtext="Fetching your customer pipeline..." />;
  }

  const hasFilter = stageFilter !== 'all' || cityFilter.length > 0 || productFilter.length > 0 || search.trim().length > 0;

  return (
    <main style={{ width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      <PageHeader
        context="Sales"
        title="Sales Hub"
        subtitle="Track customers, pipeline, coverage, and follow-ups."
        actions={
          <button onClick={() => setAdding(true)} className="topbar-pill primary">
            <Plus size={15} strokeWidth={2.2} /> Add Customer
          </button>
        }
      />

      {/* KPI strip */}
      <div style={{
        display: 'grid', gap: 12, marginBottom: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
      }}>
        <Kpi
          icon={Users} color="#2563eb"
          label="Customers"
          value={insights.total}
          sub={`${insights.open} active`}
        />
        <Kpi
          icon={TrendingUp} color="#8b5cf6"
          label="Pipeline value"
          value={formatINR(insights.pipelineValue)}
          sub={`${insights.open} open deals`}
        />
        <Kpi
          icon={Trophy} color="#22c55e"
          label="Won this quarter"
          value={`${insights.wonCount} · ${formatINR(insights.wonValue)}`}
          sub={`Since ${formatDate(startOfQuarter().toISOString())}`}
        />
        <Kpi
          icon={Globe2} color="#0ea5e9"
          label="Coverage"
          value={`${insights.cities} ${insights.cities === 1 ? 'city' : 'cities'}`}
          sub={`${insights.states} ${insights.states === 1 ? 'state' : 'states'}`}
        />
      </div>

      {insights.overdue > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, marginBottom: 18,
          backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--color-bg-surface))',
          border: '1px solid color-mix(in srgb, #ef4444 22%, transparent)',
          color: '#ef4444', fontSize: '0.85rem', fontWeight: 700
        }}>
          <AlertCircle size={16} />
          {insights.overdue} overdue follow-up{insights.overdue === 1 ? '' : 's'}
        </div>
      )}

      {/* Stage funnel */}
      {insights.total > 0 && (
        <div style={{
          padding: 14, marginBottom: 22, borderRadius: 12,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 12
          }}>Pipeline by stage</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
            {STAGE_ORDER.map(stage => {
              const meta = STAGE_META[stage];
              const count = insights.stageCounts[stage] || 0;
              const max = Math.max(...Object.values(insights.stageCounts), 1);
              const heightPct = (count / max) * 100;
              return (
                <button
                  key={stage}
                  onClick={() => setStageFilter(stage === stageFilter ? 'all' : stage)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4, cursor: 'pointer',
                    border: 'none', backgroundColor: 'transparent'
                  }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{count}</div>
                  <div style={{
                    width: '100%', height: `${heightPct}%`, minHeight: 4,
                    backgroundColor: stageFilter === stage ? meta.color : `color-mix(in srgb, ${meta.color} 35%, transparent)`,
                    borderRadius: 6, transition: 'background-color 0.15s'
                  }} />
                  <div style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: stageFilter === stage ? meta.color : 'var(--color-text-muted)'
                  }}>{meta.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterPill active={stageFilter === 'all'} onClick={() => setStageFilter('all')} count={insights.total}>All</FilterPill>
          <FilterPill active={stageFilter === 'open'} onClick={() => setStageFilter('open')} count={insights.open}>Open</FilterPill>
          {STAGE_ORDER.map(stage => (
            <FilterPill
              key={stage}
              active={stageFilter === stage}
              onClick={() => setStageFilter(stage)}
              count={insights.stageCounts[stage]}
              accent={STAGE_META[stage].color}
            >{STAGE_META[stage].label}</FilterPill>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {cityOptions.length > 0 && (
            <ChipFilter
              icon={MapPin}
              allLabel="All cities"
              pluralLabel="cities"
              options={cityOptions}
              selected={cityFilter}
              onToggle={toggleCity}
              onClear={() => setCityFilter([])}
              open={showCityMenu}
              setOpen={setShowCityMenu}
            />
          )}
          {productOptions.length > 0 && (
            <ChipFilter
              icon={Briefcase}
              allLabel="All products"
              pluralLabel="products"
              options={productOptions}
              selected={productFilter}
              onToggle={toggleProduct}
              onClear={() => setProductFilter([])}
              open={showProductMenu}
              setOpen={setShowProductMenu}
            />
          )}

          <div style={{ position: 'relative', minWidth: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, city, product, notes…"
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

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          totalCount={customers.length}
          hasFilter={hasFilter}
          onAdd={() => setAdding(true)}
        />
      ) : (
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
        }}>
          {filtered.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              onEdit={() => setEditingId(c.id)}
              onDelete={() => deleteCustomer(c.id)}
              onStageChange={(stage) => updateCustomer(c.id, { stage })}
              onLogContact={() => updateCustomer(c.id, { lastContactAt: new Date().toISOString() })}
            />
          ))}
        </div>
      )}

      {(adding || editingId) && (
        <CustomerFormModal
          existing={editingId ? customers.find(c => c.id === editingId) : null}
          productOptions={productOptions}
          onSave={saveCustomer}
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

function FilterPill({ active, onClick, count, accent, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 999,
        border: '1px solid ' + (active ? (accent || 'var(--color-primary)') : 'var(--color-border)'),
        backgroundColor: active ? `color-mix(in srgb, ${accent || 'var(--color-primary)'} 12%, var(--color-bg-surface))` : 'var(--color-bg-surface)',
        color: active ? (accent || 'var(--color-primary)') : 'var(--color-text-muted)',
        fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6
      }}>
      {children}
      {count !== undefined && <span style={{ opacity: 0.6, fontWeight: 600 }}>{count || 0}</span>}
    </button>
  );
}

function CustomerCard({ customer, onEdit, onDelete, onStageChange, onLogContact }) {
  const meta = STAGE_META[customer.stage] || STAGE_META.lead;
  const followUpDays = daysBetween(customer.nextFollowUpAt);
  const isOverdue = followUpDays !== null && followUpDays < 0;
  const isSoon = followUpDays !== null && followUpDays >= 0 && followUpDays <= 3;

  return (
    <div style={{
      position: 'relative', padding: 16, borderRadius: 14,
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `4px solid ${meta.color}`,
      display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
          color: meta.color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Building2 size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{customer.name}</div>
          {customer.contactPerson && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{customer.contactPerson}</div>
          )}
        </div>
        <StageSelect value={customer.stage} onChange={onStageChange} accent={meta.color} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        {(customer.city || customer.state) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} /> {[customer.city, customer.state].filter(Boolean).join(', ')}
          </span>
        )}
        {customer.product && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Briefcase size={12} /> {customer.product}
          </span>
        )}
        {customer.estimatedValue > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--color-text-main)' }}>
            {formatINR(customer.estimatedValue)}/mo
          </span>
        )}
      </div>

      {(customer.phone || customer.email) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.75rem' }}>
          {customer.phone && (
            <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()}
               style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', textDecoration: 'none' }}>
              <Phone size={12} /> {customer.phone}
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()}
               style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', textDecoration: 'none' }}>
              <Mail size={12} /> {customer.email}
            </a>
          )}
        </div>
      )}

      {customer.notes && (
        <div style={{
          fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>{customer.notes}</div>
      )}

      {customer.tags && customer.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {customer.tags.map(t => (
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
        {customer.nextFollowUpAt ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: isOverdue ? '#ef4444' : isSoon ? '#f59e0b' : 'var(--color-text-muted)',
            fontWeight: isOverdue || isSoon ? 700 : 500
          }}>
            <Calendar size={11} />
            {isOverdue ? `Overdue · ${formatDate(customer.nextFollowUpAt)}`
              : isSoon ? `Follow up ${followUpDays === 0 ? 'today' : `in ${followUpDays}d`}`
              : `Follow up ${formatDate(customer.nextFollowUpAt)}`}
          </span>
        ) : customer.lastContactAt ? (
          <span>Last contact {formatDate(customer.lastContactAt)}</span>
        ) : (
          <span style={{ fontStyle: 'italic' }}>No contact yet</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <IconButton title="Log contact today" onClick={onLogContact}>
            <Phone size={13} color="var(--color-text-light)" />
          </IconButton>
          <IconButton title="Edit" onClick={onEdit}>
            <Edit3 size={13} color="var(--color-text-light)" />
          </IconButton>
          <IconButton title="Delete" onClick={onDelete}>
            <Trash2 size={13} color="var(--color-text-light)" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function StageSelect({ value, onChange, accent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = STAGE_META[value] || STAGE_META.lead;

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
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: accent || meta.color, flexShrink: 0
        }} />
        {meta.label}
        <ChevronDown size={11} color="var(--color-text-muted)"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          minWidth: 140,
          backgroundColor: 'var(--chrome-bg-raised)',
          borderRadius: 10,
          boxShadow: '0 12px 28px -8px rgba(0,0,0,0.18)',
          padding: 4, zIndex: 200
        }}>
          {STAGE_ORDER.map(s => {
            const m = STAGE_META[s];
            const active = value === s;
            return (
              <button
                key={s} type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  backgroundColor: active ? 'var(--color-bg-body)' : 'transparent',
                  color: 'var(--color-text-main)',
                  fontSize: '0.82rem', fontWeight: active ? 600 : 500,
                  textAlign: 'left'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: m.color, flexShrink: 0
                }} />
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
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function ChipFilter({ icon: Icon, allLabel, pluralLabel, options, selected, onToggle, onClear, open, setOpen }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
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
        <Icon size={14} /> {label}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 220, maxHeight: 320, overflowY: 'auto',
          backgroundColor: 'var(--chrome-bg-raised)',
          border: '1px solid var(--color-border)', borderRadius: 12,
          boxShadow: '0 12px 28px -8px rgba(0,0,0,0.18)',
          padding: 6, zIndex: 500
        }}>
          {options.map(o => {
            const isSelected = selected.includes(o);
            return (
              <button
                key={o} type="button" onClick={() => onToggle(o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
                  fontSize: '0.85rem', fontWeight: 600, textAlign: 'left'
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: '1.5px solid ' + (isSelected ? 'var(--color-primary)' : 'var(--color-border)'),
                  backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                </span>
                {o}
              </button>
            );
          })}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { onClear(); setOpen(false); }}
              style={{
                marginTop: 4, width: '100%', padding: '8px 12px', borderRadius: 8,
                border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
                color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, textAlign: 'left',
                borderTop: '1px solid var(--color-border-light)'
              }}>
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ totalCount, hasFilter, onAdd }) {
  return (
    <div style={{
      textAlign: 'center', padding: '56px 20px',
      backgroundColor: 'var(--color-bg-surface)',
      borderRadius: 14, border: '1px dashed var(--color-border)'
    }}>
      <Building2 size={36} color="var(--color-text-light)" style={{ marginBottom: 14 }} />
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>
        {totalCount === 0 ? 'Your sales hub is empty' : 'No matching customers'}
      </h3>
      <p style={{
        fontSize: '0.85rem', color: 'var(--color-text-muted)',
        maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.5
      }}>
        {totalCount === 0
          ? 'Add customers to track your pipeline, follow-ups, and coverage by city.'
          : 'Try a different filter or search term.'}
      </p>
      {!hasFilter && (
        <button onClick={onAdd} className="topbar-pill primary" style={{ display: 'inline-flex' }}>
          <Plus size={14} strokeWidth={2.2} /> Add your first customer
        </button>
      )}
    </div>
  );
}

function CustomerFormModal({ existing, productOptions, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: existing?.name || '',
    contactPerson: existing?.contactPerson || '',
    phone: existing?.phone || '',
    email: existing?.email || '',
    city: existing?.city || '',
    state: existing?.state || '',
    stage: existing?.stage || 'lead',
    product: existing?.product || (productOptions?.[0] || ''),
    estimatedValue: existing?.estimatedValue || '',
    lastContactAt: existing?.lastContactAt ? existing.lastContactAt.slice(0, 10) : '',
    nextFollowUpAt: existing?.nextFollowUpAt ? existing.nextFollowUpAt.slice(0, 10) : '',
    notes: existing?.notes || '',
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
    if (!form.name.trim()) return;
    const tags = form.tagsText.split(',').map(t => t.trim()).filter(Boolean);
    onSave({
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      stage: form.stage,
      product: form.product.trim(),
      estimatedValue: Number(form.estimatedValue) || 0,
      lastContactAt: form.lastContactAt ? new Date(form.lastContactAt).toISOString() : null,
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
      notes: form.notes.trim(),
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
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {existing ? 'Edit customer' : 'Add customer'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Company name *">
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Acme Pharmacy" autoFocus required style={inputStyle} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Contact person">
              <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Owner name" style={inputStyle} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 …" style={inputStyle} />
            </Field>
          </div>

          <Field label="Email">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@acme.com" style={inputStyle} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="City">
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Hyderabad" style={inputStyle} />
            </Field>
            <Field label="State">
              <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="Telangana" style={inputStyle} />
            </Field>
          </div>

          <Field label="Stage">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGE_ORDER.map(s => {
                const meta = STAGE_META[s];
                const active = form.stage === s;
                return (
                  <button key={s} type="button" onClick={() => set('stage', s)}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Product">
              {productOptions && productOptions.length > 0 ? (
                <select value={form.product} onChange={e => set('product', e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input value={form.product} onChange={e => set('product', e.target.value)} placeholder="Pharmacy ERP" style={inputStyle} />
              )}
            </Field>
            <Field label="Estimated value (₹/month)">
              <input type="number" min="0" value={form.estimatedValue} onChange={e => set('estimatedValue', e.target.value)} placeholder="50000" style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Last contact">
              <input type="date" value={form.lastContactAt} onChange={e => set('lastContactAt', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Next follow-up">
              <input type="date" value={form.nextFollowUpAt} onChange={e => set('nextFollowUpAt', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Decision maker, budget cycle, objections…"
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
          </Field>

          <Field label="Tags (comma separated)">
            <input value={form.tagsText} onChange={e => set('tagsText', e.target.value)} placeholder="enterprise, referral, hot" style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer'
            }}>Cancel</button>
            <button type="submit" disabled={!form.name.trim()} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              border: 'none', backgroundColor: '#0f172a', color: 'white',
              fontWeight: 700,
              cursor: form.name.trim() ? 'pointer' : 'not-allowed',
              opacity: form.name.trim() ? 1 : 0.5
            }}>{existing ? 'Save changes' : 'Add customer'}</button>
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
