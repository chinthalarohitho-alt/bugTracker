"use client";
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './components/AuthProvider';
import { Bug, ArrowRight, User, GitPullRequest, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import GlobalHeader from './components/GlobalHeader';
import LoadingOverlay from './components/LoadingOverlay';

export default function DashboardPage() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentReporter } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/bugs');
        const data = await res.json();
        const bugsArr = Array.isArray(data) ? data : (data.bugs || []);
        let sortedBugs = bugsArr.sort((a, b) => {
          const numA = parseInt(a.id.replace(/\D/g, '') || '0');
          const numB = parseInt(b.id.replace(/\D/g, '') || '0');
          return numB - numA;
        });
        setBugs(sortedBugs);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ----------------------------------------------------
  // METRICS & CALCULATIONS
  // ----------------------------------------------------

  const {
    myBugs
  } = useMemo(() => {

    // Assigned to Me
    const userBugs = bugs.filter(b => b.assignee === currentReporter);
    const myBugs = userBugs.filter(b => b.status !== 'Resolved').slice(0, 10);

    return {
      myBugs
    };
  }, [bugs, currentReporter]);

  if (loading) return <LoadingOverlay message="Preparing Mission Control" subtext="Analyzing team performance and bug priority..." />;

  return (
    <main style={{ padding: '20px 40px 80px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <GlobalHeader />
      </div>

      <header style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ backgroundColor: '#eef2ff', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Mission Control Dashboard
          </div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--color-text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
          Welcome back, {currentReporter}
        </h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '32px' }}>

        {/* Assigned to Me */}
        <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Your Desk</div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginTop: '4px' }}>Tasks currently assigned to you</p>
            </div>
            <Link href="/bugs" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myBugs.map(bug => (
              <Link href={`/bugs?bug=${bug.id}`} key={bug.id} className="item-row" style={{
                padding: '16px 20px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', textDecoration: 'none', transition: 'all 0.2s', display: 'block'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>{bug.title}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '600', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', textTransform: 'uppercase' }}>{bug.status}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>{bug.id} • {bug.project || 'General'}</div>
                  {bug.priority?.toLowerCase() === 'critical' && <span style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '0.65rem', borderRadius: '6px', fontWeight: '600' }}>CRITICAL</span>}
                </div>
              </Link>
            ))}
            {myBugs.length === 0 && <div style={{ fontSize: '0.9rem', color: '#10b981', backgroundColor: '#ecfdf5', padding: '24px', borderRadius: '14px', textAlign: 'center', fontWeight: '600' }}>You have no pending tasks. Great job!</div>}
          </div>
        </section>

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
        .item-row:hover {
          border-color: var(--color-primary) !important;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
