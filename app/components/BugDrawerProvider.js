"use client";
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import BugDetails from './BugDetails';

const BugDrawerContext = createContext({
  openBug: () => {},
  closeBug: () => {},
});

export const useBugDrawer = () => useContext(BugDrawerContext);

export default function BugDrawerProvider({ children }) {
  const { currentReporter, globalBugs, globalSettings } = useAuth();
  const router = useRouter();
  const [viewingBug, setViewingBug] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = useCallback((message) => {
    if (typeof window !== 'undefined' && window.__bugDrawerToastTimer) clearTimeout(window.__bugDrawerToastTimer);
    setToast({ message, visible: true });
    if (typeof window !== 'undefined') {
      window.__bugDrawerToastTimer = setTimeout(() => setToast({ message: '', visible: false }), 3000);
    }
  }, []);

  // Accepts either a bug object or a bug id. Falls back to /bugs route if id can't be resolved.
  const openBug = useCallback((bugOrId) => {
    if (!bugOrId) return;
    let bug = bugOrId;
    if (typeof bugOrId === 'string') {
      bug = (globalBugs || []).find(b => b.id === bugOrId);
      if (!bug) {
        router.push(`/bugs?bug=${bugOrId}`);
        return;
      }
    }
    setViewingBug(bug);
    setIsOpen(true);
  }, [globalBugs, router]);

  const closeBug = useCallback(() => {
    setIsOpen(false);
    setViewingBug(null);
  }, []);

  // If the currently viewed bug changes in globalBugs (e.g. after another component mutates it), reflect it.
  useEffect(() => {
    if (!viewingBug || !globalBugs) return;
    const fresh = globalBugs.find(b => b.id === viewingBug.id);
    if (fresh && fresh !== viewingBug) setViewingBug(fresh);
  }, [globalBugs, viewingBug]);

  const updateBug = useCallback(async (bug, changes) => {
    const updated = { ...bug, ...changes, updatedBy: currentReporter };
    setViewingBug(prev => prev?.id === bug.id ? updated : prev);
    try {
      const res = await fetch('/api/bugs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bug) {
          setViewingBug(prev => prev?.id === bug.id ? data.bug : prev);
        }
      }
    } catch (err) {
      console.error('updateBug failed:', err);
      showToast('Update failed');
    }
  }, [currentReporter, showToast]);

  return (
    <BugDrawerContext.Provider value={{ openBug, closeBug }}>
      {children}
      <BugDetails
        isOpen={isOpen}
        bug={viewingBug}
        allBugs={globalBugs || []}
        settings={globalSettings || {}}
        currentReporter={currentReporter}
        onClose={closeBug}
        onEdit={(bug) => router.push(`/bugs?bug=${bug.id}`)}
        onNavigate={(bug) => setViewingBug(bug)}
        onQuickUpdate={(bug, changes) => updateBug(bug, changes)}
        onStatusUpdate={(bug, status) => {
          updateBug(bug, { status });
          showToast('Status updated!');
        }}
        showToast={showToast}
      />
      <div style={{
        position: 'fixed', bottom: '32px', right: '32px',
        backgroundColor: '#ffffff', color: '#0f172a',
        padding: '12px 24px', borderRadius: '12px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.12)',
        zIndex: 9999, transition: 'all 0.3s',
        transform: toast.visible ? 'translateY(0)' : 'translateY(100px)',
        opacity: toast.visible ? 1 : 0,
        pointerEvents: toast.visible ? 'auto' : 'none'
      }}>
        {toast.message}
      </div>
    </BugDrawerContext.Provider>
  );
}
