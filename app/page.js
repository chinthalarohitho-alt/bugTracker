"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth, capitalizeName } from './components/AuthProvider';
import PageHeader from './components/PageHeader';
import LoadingOverlay from './components/LoadingOverlay';
import QADashboard from './components/QADashboard';
import DevDashboard from './components/DevDashboard';
import OverviewDashboard from './components/OverviewDashboard';
import HRDashboard from './components/HRDashboard';
import SalesDashboard from './components/SalesDashboard';
import DesignerDashboard from './components/DesignerDashboard';
import BugDetails from './components/BugDetails';
import { useRouter } from 'next/navigation';

const DEV_ROLES = ['Developer', 'DevOps', 'Tech Lead', 'Engineering Manager'];
const QA_ROLES = ['QA Engineer'];
const HR_ROLES = ['HR Admin'];
const SALES_ROLES = ['Sales Manager'];
const DESIGNER_ROLES = ['Designer'];

function inferView(role) {
  if (!role) return 'overview';
  if (DEV_ROLES.includes(role)) return 'dev';
  if (QA_ROLES.includes(role)) return 'qa';
  if (HR_ROLES.includes(role)) return 'hr';
  if (SALES_ROLES.includes(role)) return 'sales';
  if (DESIGNER_ROLES.includes(role)) return 'designer';
  return 'overview';
}

function nameOf(v) {
  if (typeof v === 'object' && v !== null) return v.name || '';
  if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v).name || v; } catch { return v; } }
  return v || '';
}

// Ping the counterpart role when a bug transitions between hand-off states.
const HANDOFF_MESSAGES = {
  'In PR':            { target: 'reporter', msg: 'raised a PR — ready for your review' },
  'Ready for Deploy': { target: 'assignee', msg: 'approved the PR — please deploy to dev env' },
  'In Testing':       { target: 'reporter', msg: 'deployed to dev env — please verify' },
  'Closed':           { target: 'assignee', msg: 'verified the fix — bug closed' }
};

async function notifyStatusChange(oldBug, newBug, actor) {
  if (!oldBug || !newBug || oldBug.status === newBug.status) return;
  const rule = HANDOFF_MESSAGES[newBug.status];
  if (!rule) return;
  const target = rule.target === 'reporter' ? nameOf(newBug.reporter) : nameOf(newBug.assignee);
  if (!target || target === actor) return;
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_user: target,
        actor: actor || 'System',
        bug_id: newBug.id,
        message: `${actor || 'Someone'} ${rule.msg}`
      })
    });
  } catch (err) {
    console.error('Notify failed:', err);
  }
}

export default function DashboardPage() {
  const { currentReporter, userRole, globalBugs, globalSettings } = useAuth();
  const router = useRouter();
  const [bugs, setBugs] = useState(() => {
    const arr = Array.isArray(globalBugs) ? [...globalBugs] : [];
    return arr.sort((a, b) => {
      const numA = parseInt(String(a.id).replace(/\D/g, '') || '0');
      const numB = parseInt(String(b.id).replace(/\D/g, '') || '0');
      return numB - numA;
    });
  });
  const [loading, setLoading] = useState(globalBugs.length === 0);
  const [view, setView] = useState(null); // 'qa' | 'dev' | 'overview'
  const [viewingBug, setViewingBug] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = useCallback((message) => {
    if (typeof window !== 'undefined' && window.__dashToastTimer) clearTimeout(window.__dashToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__dashToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  }, []);

  const handleOpenBug = useCallback((bug) => {
    setViewingBug(bug);
    setIsDetailsOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDetailsOpen(false);
    setViewingBug(null);
  }, []);

  useEffect(() => {
    if (globalBugs.length > 0) {
      const sorted = [...globalBugs].sort((a, b) => {
        const numA = parseInt(String(a.id).replace(/\D/g, '') || '0');
        const numB = parseInt(String(b.id).replace(/\D/g, '') || '0');
        return numB - numA;
      });
      setBugs(sorted);
      setLoading(false);
    }
  }, [globalBugs]);

  useEffect(() => {
    fetch('/api/bugs')
      .then(res => res.ok ? res.json() : { bugs: [] })
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.bugs || []);
        const sorted = arr.sort((a, b) => {
          const numA = parseInt(String(a.id).replace(/\D/g, '') || '0');
          const numB = parseInt(String(b.id).replace(/\D/g, '') || '0');
          return numB - numA;
        });
        setBugs(sorted);
      })
      .catch(err => console.error("Error fetching dashboard data:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setView(inferView(userRole));
  }, [userRole]);

  const updateBug = useCallback(async (updated) => {
    const previous = bugs.find(b => b.id === updated.id);
    setBugs(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
    try {
      const res = await fetch('/api/bugs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        const saved = data.bug || updated;
        setBugs(prev => prev.map(b => b.id === saved.id ? saved : b));
        notifyStatusChange(previous, saved, currentReporter);
      }
    } catch (err) {
      console.error('Bug update failed:', err);
    }
  }, [bugs, currentReporter]);

  if (loading || view === null) {
    return <LoadingOverlay message="Preparing Mission Control" subtext="Analyzing team performance and bug priority..." />;
  }

  const subtitle =
    view === 'qa' ? "Here's your QA pipeline today."
    : view === 'dev' ? "Here's what you're shipping today."
    : view === 'hr' ? "Here's how your team is looking today."
    : view === 'sales' ? "Here's what's impacting your customers today."
    : view === 'designer' ? "Here's what needs a designer's eye today."
    : "Here's what's happening with your projects today.";

  return (
    <main style={{ width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      <PageHeader
        context="Default"
        title={`Hey, ${capitalizeName(currentReporter?.split(' ')[0]) || 'there'}!`}
        subtitle={subtitle}
      />

      {view === 'qa' && (
        <QADashboard bugs={bugs} currentReporter={currentReporter} onUpdateBug={updateBug} onOpenBug={handleOpenBug} />
      )}
      {view === 'dev' && (
        <DevDashboard bugs={bugs} currentReporter={currentReporter} onUpdateBug={updateBug} onOpenBug={handleOpenBug} />
      )}
      {view === 'hr' && (
        <HRDashboard bugs={bugs} />
      )}
      {view === 'sales' && (
        <SalesDashboard bugs={bugs} onOpenBug={handleOpenBug} />
      )}
      {view === 'designer' && (
        <DesignerDashboard bugs={bugs} currentReporter={currentReporter} onUpdateBug={updateBug} onOpenBug={handleOpenBug} />
      )}
      {view === 'overview' && (
        <OverviewDashboard bugs={bugs} onOpenBug={handleOpenBug} />
      )}

      <BugDetails
        isOpen={isDetailsOpen}
        onClose={handleCloseDrawer}
        onEdit={(bug) => router.push(`/bugs?bug=${bug.id}`)}
        onStatusUpdate={(bug, newStatus) => {
          const updated = { ...bug, status: newStatus };
          updateBug(updated);
          setViewingBug(updated);
          showToast('Status updated!');
        }}
        onNavigate={(bug) => setViewingBug(bug)}
        onQuickUpdate={(bug, changes) => {
          const updated = { ...bug, ...changes };
          updateBug(updated);
          setViewingBug(updated);
        }}
        bug={viewingBug}
        allBugs={bugs}
        settings={globalSettings || {}}
        showToast={showToast}
        currentReporter={currentReporter}
      />

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

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

