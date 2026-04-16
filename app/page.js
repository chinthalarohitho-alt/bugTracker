"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, capitalizeName } from './components/AuthProvider';
import { Bug, ArrowRight, User, GitPullRequest, AlertCircle, GripVertical, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, TrendingUp, BarChart3, FolderKanban, Settings, Zap, Activity } from 'lucide-react';
import Link from 'next/link';
import GlobalHeader from './components/GlobalHeader';
import LoadingOverlay from './components/LoadingOverlay';

export default function DashboardPage() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentReporter, globalSettings, getInitials, getAvatar } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/bugs');
        if (!res.ok) { setBugs([]); return; }
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
    myBugs, totalBugs, openBugs, inProgressBugs, resolvedBugs, criticalBugs, overdueBugs
  } = useMemo(() => {

    // Assigned to Me
    const toName = (v) => {
      if (typeof v === 'object' && v !== null) return v.name || '';
      if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
      return v || '';
    };
    const userBugs = bugs.filter(b => toName(b.assignee) === currentReporter);
    const myBugs = userBugs.filter(b => b.status !== 'Resolved').slice(0, 10);

    const totalBugs = bugs.length;
    const openBugs = bugs.filter(b => b.status === 'Open').length;
    const inProgressBugs = bugs.filter(b => ['In Progress', 'In PR', 'In Testing', 'Code Review', 'UAT'].includes(b.status)).length;
    const resolvedBugs = bugs.filter(b => ['Resolved', 'Closed'].includes(b.status)).length;
    const criticalBugs = bugs.filter(b => b.priority?.toLowerCase() === 'critical' && !['Resolved', 'Closed'].includes(b.status)).length;
    const overdueBugs = bugs.filter(b => b.endDate && new Date(b.endDate) < new Date() && !['Resolved', 'Closed'].includes(b.status)).length;

    return {
      myBugs, totalBugs, openBugs, inProgressBugs, resolvedBugs, criticalBugs, overdueBugs
    };
  }, [bugs, currentReporter]);

  const [draggedBug, setDraggedBug] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [columnPages, setColumnPages] = useState({});
  const KANBAN_PAGE_SIZE = 5;

  const kanbanColumns = useMemo(() => {
    const toName = (v) => {
      if (typeof v === 'object' && v !== null) return v.name || '';
      if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
      return v || '';
    };
    const cols = {
      'Open': { label: 'Open', color: '#3b82f6', bugs: [] },
      'In Progress': { label: 'In Progress', color: '#f59e0b', bugs: [] },
      'In PR': { label: 'In PR', color: '#8b5cf6', bugs: [] },
      'In Testing': { label: 'In Testing', color: '#06b6d4', bugs: [] },
      'Resolved': { label: 'Resolved', color: '#10b981', bugs: [] }
    };
    const aliasMap = {
      'Code Review': 'In PR',
      'Review': 'In PR',
      'In Review': 'In PR',
      'UAT': 'In Testing',
      'Testing': 'In Testing',
      'QA': 'In Testing',
      'Closed': 'Resolved',
      'ReOpen': 'Open'
    };
    bugs.forEach(bug => {
      const raw = bug.status || 'Open';
      const mapped = cols[raw] ? raw : (aliasMap[raw] || 'Open');
      cols[mapped].bugs.push(bug);
    });
    return cols;
  }, [bugs]);

  const handleKanbanDrop = async (targetStatus) => {
    if (!draggedBug || draggedBug.status === targetStatus) { setDraggedBug(null); setDragOverColumn(null); return; }
    const updated = { ...draggedBug, status: targetStatus, updatedBy: currentReporter };
    setBugs(prev => prev.map(b => b.id === draggedBug.id ? { ...b, status: targetStatus } : b));
    setDraggedBug(null);
    setDragOverColumn(null);
    try {
      await fetch('/api/bugs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      setBugs(prev => prev.map(b => b.id === draggedBug.id ? draggedBug : b));
    }
  };

  const getShortId = (id) => `BUG-${String(id).split('-')[1]?.substring(0, 4)?.toUpperCase() || ''}`;

  if (loading) return <LoadingOverlay message="Preparing Mission Control" subtext="Analyzing team performance and bug priority..." />;

  return (
    <main style={{ padding: '20px 20px 80px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <GlobalHeader />
      </div>

      {/* Top Row — Date + Greeting + CTA */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px', height: '64px', borderRadius: '16px', backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--color-text-main)', lineHeight: 1 }}>{new Date().getDate()}</div>
            <div style={{ fontSize: '0.55rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{new Date().toLocaleDateString(undefined, { month: 'short' })}</div>
          </div>
          <div>
            <h1 style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
              Hey, {capitalizeName(currentReporter?.split(' ')[0])}!
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>Here's what's happening with your projects today.</p>
          </div>
        </div>
      </div>


      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
