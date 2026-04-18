"use client";
import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../components/AuthProvider';

export default function ProjectsPage() {
  const { globalBugs, globalSettings } = useAuth();
  const [bugs, setBugs] = useState(() => Array.isArray(globalBugs) ? globalBugs : []);
  const [projects, setProjects] = useState(() => globalSettings?.projects || []);
  const [loading, setLoading] = useState(!(globalBugs?.length > 0 && globalSettings));
  const router = useRouter();

  useEffect(() => {
    if (globalBugs?.length > 0) setBugs(globalBugs);
    if (globalSettings?.projects) setProjects(globalSettings.projects);
    if (globalBugs?.length > 0 && globalSettings) setLoading(false);
  }, [globalBugs, globalSettings]);

  useEffect(() => {
    Promise.all([
      fetch('/api/bugs').then(r => r.ok ? r.json() : { bugs: [] }),
      fetch('/api/settings').then(r => r.ok ? r.json() : { projects: [] })
    ]).then(([bugsData, settingsData]) => {
      const arr = Array.isArray(bugsData) ? bugsData : (bugsData.bugs || []);
      setBugs(arr);
      setProjects(settingsData.projects || []);
    }).catch(err => console.error("Error fetching project data:", err))
      .finally(() => setLoading(false));
  }, []);

  const getProjectStats = (projectName) => {
    const projectBugs = bugs.filter(b => b.project === projectName);
    const critical = projectBugs.filter(b => b.priority?.toLowerCase() === 'critical').length;
    const high = projectBugs.filter(b => b.priority?.toLowerCase() === 'high').length;
    const resolved = projectBugs.filter(b => b.status === 'Resolved' || b.status === 'Closed').length;
    return {
      total: projectBugs.length,
      critical,
      high,
      resolved,
      urgent: critical + high,
      progress: projectBugs.length > 0 ? Math.round((resolved / projectBugs.length) * 100) : 100
    };
  };

  const open = (name) => router.push(`/bugs?project=${encodeURIComponent(name)}`);

  if (loading) return <LoadingOverlay message="Project Portfolios" subtext="Aggregating health metrics..." />;

  const list = projects.map(name => ({ name, stats: getProjectStats(name) }));

  return (
    <main style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Projects"
        subtitle="Health and bug distribution across your projects."
      />

      <div style={{ borderTop: '1px solid var(--chrome-border)' }}>
        {list.length === 0 && (
          <div style={{ padding: '40px 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            No projects yet.
          </div>
        )}
        {list.map(({ name, stats }) => (
          <ProjectRow key={name} name={name} stats={stats} onOpen={() => open(name)} />
        ))}
      </div>
    </main>
  );
}

function ProjectRow({ name, stats, onOpen }) {
  const healthy = stats.urgent === 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 16,
        padding: '16px 8px',
        borderBottom: '1px solid var(--chrome-border)',
        cursor: 'pointer',
        transition: 'background-color 0.12s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-bg-subtle)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: healthy ? '#22c55e' : '#ef4444' }} />

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{name}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
          {healthy ? 'System healthy' : `${stats.urgent} high/critical ${stats.urgent === 1 ? 'issue' : 'issues'}`}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Metric label="Total" value={stats.total} />
        <Metric label="Urgent" value={stats.urgent} tint={stats.urgent > 0 ? '#ef4444' : null} />
        <Progress value={stats.progress} />
        <ArrowRight size={16} color="var(--color-text-light)" />
      </div>
    </div>
  );
}

function Metric({ label, value, tint }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 56 }}>
      <div style={{
        fontSize: '1rem', fontWeight: 600,
        color: tint || 'var(--color-text-main)',
        lineHeight: 1, fontVariantNumeric: 'tabular-nums'
      }}>{value}</div>
      <div style={{
        fontSize: '0.66rem', fontWeight: 500,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4
      }}>{label}</div>
    </div>
  );
}

function Progress({ value }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.66rem', fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resolved</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
      </div>
      <div style={{ height: 4, width: '100%', backgroundColor: 'var(--chrome-bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', backgroundColor: 'var(--color-text-main)', borderRadius: 4 }} />
      </div>
    </div>
  );
}
