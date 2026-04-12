"use client";
import { useState, useEffect } from 'react';
import { FolderKanban, AlertCircle, CheckCircle2, Clock, ArrowRight, MoreVertical, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import GlobalHeader from '../components/GlobalHeader';
import LoadingOverlay from '../components/LoadingOverlay';

export default function ProjectsPage() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bugsRes, settingsRes] = await Promise.all([
          fetch('/api/bugs'),
          fetch('/api/settings')
        ]);
        const bugsData = await bugsRes.json();
        const settingsData = await settingsRes.json();

        // Handle both raw array and standardized { bugs: [] } object
        const bugsArr = Array.isArray(bugsData) ? bugsData : (bugsData.bugs || []);
        setBugs(bugsArr);
        setProjects(settingsData.projects || []);
      } catch (error) {
        console.error("Error fetching project data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getProjectStats = (projectName) => {
    const projectBugs = bugs.filter(b => b.project === projectName);
    const critical = projectBugs.filter(b => b.priority?.toLowerCase() === 'critical').length;
    const high = projectBugs.filter(b => b.priority?.toLowerCase() === 'high').length;
    const resolved = projectBugs.filter(b => b.status === 'Resolved').length;

    return {
      total: projectBugs.length,
      critical,
      high,
      resolved,
      progress: projectBugs.length > 0 ? Math.round((resolved / projectBugs.length) * 100) : 100
    };
  };

  const handleViewDetails = (projectName) => {
    // Navigate to bugs list with a pre-applied project filter
    router.push(`/bugs?project=${encodeURIComponent(projectName)}`);
  };

  if (loading) return <LoadingOverlay message="Project Portfolios" subtext="Aggregating health metrics and resolution progress..." />;

  const statsList = projects.map(project => ({
    name: project,
    stats: getProjectStats(project)
  }));

  return (
    <main style={{ padding: '20px 20px 80px', backgroundColor: 'var(--color-bg-body)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '16px' }}>
        <GlobalHeader
          placeholder="Search projects..."
        />
      </div>

      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '600', color: 'var(--color-text-main)', marginBottom: '8px' }}>Project Portfolios</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Monitor health and bug distribution across your vertical ERP solutions.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
        {statsList.map(({ name, stats }) => (
          <div key={name} className="card project-card" style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <FolderKanban size={24} />
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.critical > 0 ? '#ef4444' : '#22c55e' }}></div>
              {stats.critical > 0 ? `${stats.critical} Critical Issues` : 'System Healthy'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Total Issues</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1e293b' }}>{stats.total}</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>High/Crit</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ef4444' }}>{stats.critical + stats.high}</div>
              </div>
            </div>

            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Resolution Progress</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)' }}>{stats.progress}%</span>
            </div>
            <div style={{ height: '8px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ width: `${stats.progress}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
            </div>

            <button
              onClick={() => handleViewDetails(name)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: 'var(--color-text-main)',
                fontSize: '0.85rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }} className="hover-shadow">
              View Project Details <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .loading-screen {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--color-text-muted);
        }
        .project-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border-color: var(--color-primary);
        }
      `}</style>
    </main>
  );
}
