"use client";
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Plus, Bug as BugIcon, Edit3, Trash2, Search, Download, Link2, ChevronDown, Check, X, Bell, ExternalLink, MailOpen, Calendar, ArrowUpDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import BugForm from '../components/BugForm';
import BugDetails from '../components/BugDetails';
import CustomDropdown from '../components/CustomDropdown';
import { useAuth, capitalizeName } from '../components/AuthProvider';
import GlobalHeader from '../components/GlobalHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import AdvancedDateFilter from '../components/AdvancedDateFilter';


function BugManagement() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project');

  const [bugs, setBugs] = useState([]);
  const [filteredBugs, setFilteredBugs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const BUGS_PER_PAGE = 15;
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingBug, setEditingBug] = useState(null);
  const [viewingBug, setViewingBug] = useState(null);

  const [selectedProjects, setSelectedProjects] = useState(projectParam ? [projectParam] : []);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState([]);
  const [selectedReporter, setSelectedReporter] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState('desc'); // Current UI view sort
  const [toast, setToast] = useState({ message: "", visible: false });
  const [deletingBug, setDeletingBug] = useState(null);

  // Bulk selection state
  const [selectedBugs, setSelectedBugs] = useState(new Set());
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [hoveredBugId, setHoveredBugId] = useState(null);
  const [prStatuses, setPrStatuses] = useState({});
  const [selectionMode, setSelectionMode] = useState(false);

  const { currentReporter, showUserSelection: globalShowUserSelection, globalSearchQuery, setGlobalSearchQuery } = useAuth();

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

  const getFullModulePath = (bug) => {
    if (!bug.module || bug.module === 'General' || bug.module === 'Not Assigned') return null;
    const modules = PROJECT_MODULES[bug.project || "Pharmacy ERP"] || [];

    if (bug.module.startsWith(' -')) {
      const cleanChild = bug.module.substring(2);
      const idx = modules.indexOf(bug.module);
      if (idx !== -1) {
        for (let i = idx - 1; i >= 0; i--) {
          if (!modules[i].startsWith(' -')) {
            return `${modules[i]} → ${cleanChild}`;
          }
        }
      }
      return cleanChild;
    }
    return bug.module;
  };

  const reporterOptions = useMemo(() => {
    const names = new Set();
    if (settings.assignees) {
      settings.assignees.forEach(a => {
        const name = typeof a === 'object' ? a.name : a;
        if (name && name !== "Not Assigned" && name !== "Unassigned") names.add(name);
      });
    }
    bugs.forEach((b) => {
      const reporter = b.reporter || 'System';
      names.add(typeof reporter === 'string' ? reporter.trim() : 'System');
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [bugs, settings.assignees]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const isEditable = document.activeElement.isContentEditable;
        if (!isInput && !isEditable) {
          e.preventDefault();
          setEditingBug(null);
          setIsFormOpen(true);
        }
      }
      if (e.key === 'Escape' && isFormOpen) {
        setIsFormOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen]);

  const showToast = (message) => {
    if (window.toastTimer) clearTimeout(window.toastTimer);
    setToast({ message, visible: true });
    window.toastTimer = setTimeout(() => setToast({ message: "", visible: false }), 3000);
  };

  // Close selection popup on outside click
  useEffect(() => {
    if (!showSelectionPopup) return;
    const handler = (e) => {
      if (showSelectionPopup && !e.target.closest('#bulk-action-area')) {
        setShowSelectionPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSelectionPopup]);

  useEffect(() => {
    if (isFormOpen || isDetailsOpen || globalShowUserSelection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFormOpen, isDetailsOpen, globalShowUserSelection]);

  useEffect(() => {
    if (globalShowUserSelection) {
      setIsFormOpen(false);
      setIsDetailsOpen(false);
    }
  }, [globalShowUserSelection]);


  useEffect(() => {
    Promise.all([
      fetch('/api/bugs').then(res => res.ok ? res.json() : { bugs: [] }),
      fetch('/api/settings').then(res => res.ok ? res.json() : { projects: [], statuses: [], priorities: [], assignees: [] })
    ]).then(([bugsData, settingsData]) => {
      const arr = Array.isArray(bugsData) ? bugsData : (bugsData.bugs || []);
      setBugs(arr);
      setSettings(settingsData);
      setLoading(false);

      // Fetch PR statuses for all bugs that have GitHub PR links
      const allPrUrls = [];
      arr.forEach(b => {
        let prs = [];
        try {
          if (Array.isArray(b.githubPr)) prs = b.githubPr;
          else if (typeof b.githubPr === 'string' && b.githubPr.startsWith('[')) prs = JSON.parse(b.githubPr);
          else if (b.githubPr) prs = [b.githubPr];
        } catch {}
        prs.filter(pr => pr && pr.includes('github.com') && pr.includes('/pull/')).forEach(pr => allPrUrls.push(pr));
      });
      if (allPrUrls.length > 0) {
        fetch('/api/github/pr-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [...new Set(allPrUrls)] })
        })
          .then(r => r.json())
          .then(data => {
            if (data.statuses) {
              const map = {};
              data.statuses.forEach(s => { map[s.url] = s; });
              setPrStatuses(map);
            }
          })
          .catch(() => {});
      }

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const bugId = urlParams.get('bug');
        if (bugId) {
          const target = arr.find(b => b.id === bugId);
          if (target) {
            setViewingBug(target);
            setIsDetailsOpen(true);
          }
        }
      }
    });
  }, []);

  useEffect(() => {
    let result = bugs;
    if (selectedProjects.length > 0) result = result.filter(b => selectedProjects.includes(b.project));
    if (selectedStatus.length > 0) {
      result = result.filter(b => selectedStatus.includes(b.status));
    }
    if (selectedPriority.length > 0) result = result.filter(b => selectedPriority.includes(b.priority));
    if (selectedAssignee.length > 0) result = result.filter(b => selectedAssignee.includes(toName(b.assignee)));
    if (selectedReporter.length > 0) {
      result = result.filter((b) => {
        const r = b.reporter?.trim() ? b.reporter : 'System';
        return selectedReporter.includes(r);
      });
    }
    if (globalSearchQuery) {
      const q = globalSearchQuery.toLowerCase();
      result = result.filter(b =>
        String(b.title || '').toLowerCase().includes(q) ||
        String(b.description || '').toLowerCase().includes(q) ||
        String(b.id || '').toLowerCase().includes(q)
      );
    }
    
    // Date Filtering
    if (startDate) {
      const s = new Date(startDate);
      result = result.filter(b => new Date(b.createdAt) >= s);
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      result = result.filter(b => new Date(b.createdAt) <= e);
    }

    // Sorting
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    setFilteredBugs(result);
    setCurrentPage(1);
  }, [bugs, selectedProjects, selectedStatus, selectedPriority, selectedAssignee, selectedReporter, globalSearchQuery, startDate, endDate, sortOrder]);

  const [saving, setSaving] = useState(false);

  const handleSaveBug = async (bugData, isNew) => {
    setSaving(true);
    try {
    if (isNew) {
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bugData, reporter: currentReporter })
      });
      const result = await res.json();
      if (result.success) {
        setBugs([...bugs, result.bug]);
        showToast(`${result.bug.id} created successfully!`);
      }
    } else {
      const res = await fetch('/api/bugs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bugData, updatedBy: currentReporter })
      });
      const result = await res.json();
      if (result.success) {
        setBugs(bugs.map(b => b.id === bugData.id ? result.bug : b));
        if (viewingBug?.id === bugData.id) {
          setViewingBug(result.bug);
        }
        showToast(`${result.bug.id} updated successfully!`);
      }
    }
    setIsFormOpen(false);
    setEditingBug(null);
    } catch (err) {
      showToast("Failed to save bug.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (bug, e) => {
    e.stopPropagation();
    setDeletingBug(bug);
  };

  const [singleDeleting, setSingleDeleting] = useState(false);
  const [undoDelete, setUndoDelete] = useState(null);
  const undoRef = useRef(null);
  const pendingDeleteRef = useRef(null);

  // Fire pending delete on unmount (e.g. navigating away)
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        const bugId = pendingDeleteRef.current;
        fetch('/api/bugs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: bugId })
        }).catch(() => {});
      }
    };
  }, []);

  const confirmDelete = () => {
    if (!deletingBug) return;
    const bugToDelete = deletingBug;
    const shortId = `BUG-${String(bugToDelete.id).split('-')[1]?.substring(0, 4)?.toUpperCase() || ''}`;

    // Soft-remove from UI
    setBugs(prev => prev.filter(b => b.id !== bugToDelete.id));
    setDeletingBug(null);

    // Clear any previous undo timer
    if (undoRef.current) clearTimeout(undoRef.current);

    // Track pending delete for cleanup on unmount
    pendingDeleteRef.current = bugToDelete.id;

    // Set undo state — user has 5 seconds to undo
    const timer = setTimeout(async () => {
      setUndoDelete(null);
      pendingDeleteRef.current = null;
      try {
        const res = await fetch('/api/bugs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: bugToDelete.id })
        });
        if (!res.ok) {
          setBugs(prev => [...prev, bugToDelete]);
          showToast("Failed to delete. Bug restored.");
        }
      } catch {
        setBugs(prev => [...prev, bugToDelete]);
        showToast("Network error. Bug restored.");
      }
    }, 5000);

    undoRef.current = timer;
    setUndoDelete({ bug: bugToDelete, shortId });
  };

  const handleUndo = () => {
    if (!undoDelete) return;
    if (undoRef.current) clearTimeout(undoRef.current);
    pendingDeleteRef.current = null;
    setBugs(prev => [...prev, undoDelete.bug]);
    showToast(`${undoDelete.shortId} restored!`);
    setUndoDelete(null);
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedBugs.size === 0) return;
    setBulkDeleting(true);
    const idsToDelete = Array.from(selectedBugs);
    const previousBugs = [...bugs];
    const previousSelected = new Set(selectedBugs);

    setBugs(bugs.filter(b => !selectedBugs.has(b.id)));
    setSelectedBugs(new Set());

    try {
      const res = await fetch('/api/bugs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete })
      });
      const result = await res.json();
      if (result.success) {
        showToast(`${result.deletedCount || idsToDelete.length} bugs permanently deleted!`);
      } else {
        setBugs(previousBugs);
        setSelectedBugs(previousSelected);
        showToast("Failed to delete bugs. Changes reverted.");
      }
    } catch (err) {
      setBugs(previousBugs);
      setSelectedBugs(previousSelected);
      showToast("Network error. Delete reverted.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleEdit = (bug, e) => {
    e.stopPropagation();
    setEditingBug(bug);
    setIsFormOpen(true);
  };

  const handleQuickUpdate = async (bug, changes, e) => {
    if (e) e.stopPropagation();
    const updatedBug = { ...bug, ...changes, updatedBy: currentReporter };

    // Optimistic update — reflect changes immediately in UI
    setBugs(prev => prev.map(b => b.id === bug.id ? updatedBug : b));
    if (viewingBug && viewingBug.id === bug.id) {
      setViewingBug(updatedBug);
    }

    try {
      const res = await fetch('/api/bugs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBug)
      });
      const result = await res.json();
      if (result.success && result.bug) {
        // Reconcile with server version (may include server-generated fields)
        setBugs(prev => prev.map(b => b.id === bug.id ? result.bug : b));
        if (viewingBug && viewingBug.id === bug.id) {
          setViewingBug(result.bug);
        }
      } else {
        // Revert on failure
        setBugs(prev => prev.map(b => b.id === bug.id ? bug : b));
        if (viewingBug && viewingBug.id === bug.id) setViewingBug(bug);
        showToast('Update failed. Reverted.');
      }
    } catch (err) {
      setBugs(prev => prev.map(b => b.id === bug.id ? bug : b));
      if (viewingBug && viewingBug.id === bug.id) setViewingBug(bug);
      showToast('Network error. Reverted.');
    }
  };


  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      default: return 'badge-low';
    }
  };

  const toName = (val) => {
    if (typeof val === 'object' && val !== null) return val.name || '';
    if (typeof val === 'string' && val.startsWith('{')) { try { return JSON.parse(val).name || val; } catch { return val; } }
    return val || '';
  };

  const getInitials = (name) => {
    const n = toName(name);
    if (!n || n === 'Unassigned' || n === 'Not Assigned') return 'UN';
    const parts = n.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.substring(0, 2).toUpperCase();
  };


  const formatDate = (dateInput) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) return date.toLocaleDateString();
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const convertedDate = new Date(excelEpoch.getTime() + dateInput * 86400000);
      return convertedDate.toLocaleDateString();
    }
    return 'Invalid Date';
  };

  const formatUrl = (url) => {
    if (!url || typeof url !== 'string') return "#";
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const downloadCSV = () => {
    // Columns as requested: including steps, curl, and pr
    const columns = ['id', 'title', 'description', 'stepsToReproduce', 'curl', 'githubPr', 'status', 'priority', 'severity', 'project', 'assignee', 'reporter', 'createdAt'];
    const header = columns.join(',');
    
    const escape = (val) => {
      if (Array.isArray(val)) {
        return `"${val.join(' | ').replace(/"/g, '""')}"`;
      }
      return `"${String(val || '').replace(/"/g, '""')}"`;
    };

    // Sort by createdAt ASCENDING for CSV as requested
    const sortedForExport = [...filteredBugs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const rows = sortedForExport.map(bug => columns.map(col => escape(bug[col])).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bugs_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    const hasFilters = selectedProjects.length > 0 || selectedStatus.length > 0 || selectedPriority.length > 0 || selectedAssignee.length > 0 || selectedReporter.length > 0 || globalSearchQuery;
    showToast(`Exported ${filteredBugs.length}${hasFilters ? ' filtered' : ''} bug(s) to CSV!`);
  };

  const toggleFilter = (current, setFunc, value) => {
    if (value === 'CLEAR_ALL') {
      setFunc([]);
      return;
    }
    if (current.includes(value)) {
      setFunc(current.filter(item => item !== value));
    } else {
      setFunc([...current, value]);
    }
  };

  const handleClearFilters = () => {
    setSelectedProjects([]);
    setSelectedStatus([]);
    setSelectedPriority([]);
    setSelectedAssignee([]);
    setSelectedReporter([]);
    setStartDate("");
    setEndDate("");
    setGlobalSearchQuery("");
    showToast("All filters cleared!");
  };

  const getShortId = (uuid) => {
    if (!uuid) return "BUG-X";
    if (String(uuid).startsWith("BUG-")) return uuid;
    const segment = String(uuid).split('-')[0] || "X";
    return `BUG-${segment.substring(0, 4).toUpperCase()}`;
  };

  if (loading) return <LoadingOverlay message="Synchronizing Bugs" subtext="Accessing the latest bug streams and team analytics..." />;

  return (
    <div style={{
      width: '100%',
      padding: '0 20px 120px',
      backgroundColor: 'var(--color-bg-body)',
      minHeight: '100vh',
      animation: 'fadeIn 0.4s ease-out'
    }}>
      {/* Sticky header section with premium blur */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'color-mix(in srgb, var(--color-bg-body) 90%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        paddingTop: '20px',
        paddingBottom: '16px',
        margin: '0 -20px',
        paddingLeft: '20px',
        paddingRight: '20px',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Top bar: Global Header with Search & Notifications */}
        <GlobalHeader
          placeholder="Search bugs, projects, team..."
        />

        {/* Second bar: Title & Create Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.75rem)', fontWeight: '600', marginBottom: '0', letterSpacing: '-0.02em' }}>
                {selectedProjects.length === 1 ? `${selectedProjects[0]} Bugs` : 'Bug Management'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700' }}>
                  {filteredBugs.length} Total
                </span>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>Track, manage, and resolve bugs across projects</p>
          </div>

          <button
            className="btn btn-primary"
            style={{ height: '38px', padding: '0 14px', borderRadius: '10px', fontWeight: '700', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => { setEditingBug(null); setIsFormOpen(true); }}
          >
            <Plus size={18} strokeWidth={2.5} /> Create Bug
          </button>
        </div>

        <div className="filter-bar-group" style={{ marginBottom: '16px' }}>
          <CustomDropdown label="All Reporter" options={reporterOptions} selected={selectedReporter} onSelect={(val) => toggleFilter(selectedReporter, setSelectedReporter, val)} isMulti />
          <CustomDropdown label="All Project" options={settings.projects} selected={selectedProjects} onSelect={(val) => toggleFilter(selectedProjects, setSelectedProjects, val)} isMulti />
          <CustomDropdown label="All Status" options={settings.statuses} selected={selectedStatus} onSelect={(val) => toggleFilter(selectedStatus, setSelectedStatus, val)} isMulti />
          <CustomDropdown label="All Priority" options={settings.priorities} selected={selectedPriority} onSelect={(val) => toggleFilter(selectedPriority, setSelectedPriority, val)} isMulti />
          <CustomDropdown label="All Assignee" options={(settings.assignees || []).map(a => typeof a === 'object' ? a.name : a)} selected={selectedAssignee} onSelect={(val) => toggleFilter(selectedAssignee, setSelectedAssignee, typeof val === 'object' ? val.name : val)} isMulti />

          <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-outline"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              style={{ height: '36px', padding: '0 12px', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: '700', color: 'var(--color-primary)', borderRadius: '8px', whiteSpace: 'nowrap' }}
              title={sortOrder === 'desc' ? "Newest First" : "Oldest First"}
            >
              <ArrowUpDown size={15} /> {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </button>

            <button
              className="btn btn-outline"
              style={{ height: '36px', padding: '0 12px', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: '700', borderRadius: '8px', whiteSpace: 'nowrap' }}
              onClick={downloadCSV}
              title="Export to CSV"
            >
              <Download size={16} /> Download as CSV
            </button>
          </div>
        </div>{/* end filter-bar-group */}

        {/* Action Hub Row (Specialized Tools) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            title="Multi Delete"
            onClick={() => {
              setSelectionMode(v => !v);
              if (selectionMode) { setSelectedBugs(new Set()); setShowSelectionPopup(false); }
            }}
            style={{
              height: '38px', padding: '0 16px', background: selectionMode ? '#fef2f2' : 'var(--color-bg-surface)',
              color: selectionMode ? '#ef4444' : 'var(--color-text-muted)',
              border: selectionMode ? '1px solid #fee2e2' : '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700',
              transition: 'all 0.2s', borderRadius: '10px'
            }}
          >
            <Trash2 size={16} /> Multi Delete
          </button>

          <AdvancedDateFilter 
            startDate={startDate} 
            endDate={endDate} 
            onRangeChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }} 
          />
        </div>

        {/* Active Filter Chips */}
        {(selectedProjects.length > 0 || selectedStatus.length > 0 || selectedPriority.length > 0 || selectedAssignee.length > 0 || selectedReporter.length > 0 || globalSearchQuery || startDate || endDate) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            {globalSearchQuery && (
              <span className="filter-chip">
                Search: {globalSearchQuery}
                <button onClick={() => setGlobalSearchQuery("")}><X size={12} strokeWidth={3} /></button>
              </span>
            )}
            {selectedProjects.map(p => (
              <span key={p} className="filter-chip">
                Project: {p}
                <button onClick={() => toggleFilter(selectedProjects, setSelectedProjects, p)}><X size={12} strokeWidth={3} /></button>
              </span>
            ))}
            {selectedStatus.map(s => (
              <span key={s} className="filter-chip">
                Status: {s}
                <button onClick={() => toggleFilter(selectedStatus, setSelectedStatus, s)}><X size={12} strokeWidth={3} /></button>
              </span>
            ))}
            {selectedPriority.map(p => (
              <span key={p} className="filter-chip">
                Priority: {p}
                <button onClick={() => toggleFilter(selectedPriority, setSelectedPriority, p)}><X size={12} strokeWidth={3} /></button>
              </span>
            ))}
            {selectedAssignee.map(a => (
              <span key={a} className="filter-chip">
                Assignee: {a}
                <button onClick={() => toggleFilter(selectedAssignee, setSelectedAssignee, a)}><X size={12} strokeWidth={3} /></button>
              </span>
            ))}
            {selectedReporter.map(r => (
              <span key={r} className="filter-chip">
                Reporter: {r}
                <button onClick={() => toggleFilter(selectedReporter, setSelectedReporter, r)}><X size={12} strokeWidth={3} /></button>
              </span>
            ))}
            {(startDate || endDate) && (
              <span className="filter-chip">
                Date: {startDate || '...'} to {endDate || '...'}
                <button onClick={() => { setStartDate(""); setEndDate(""); }}><X size={12} strokeWidth={3} /></button>
              </span>
            )}
            <button onClick={handleClearFilters} className="clear-all-btn">Clear All</button>
          </div>
        )}
      </div>{/* end sticky header */}

      <div style={{ paddingTop: '12px' }}>
        {filteredBugs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', opacity: 0.5 }}>
            <BugIcon size={48} style={{ marginBottom: '16px', margin: '0 auto' }} color="var(--color-text-muted)" />
            {bugs.length === 0 ? (
              <>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No bugs yet!</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Press <strong>Ctrl+N</strong> or the <strong>+ New Bug</strong> button to create your first report.</p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No matching bugs</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Try adjusting your filters or search terms.</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {filteredBugs.slice((currentPage - 1) * BUGS_PER_PAGE, currentPage * BUGS_PER_PAGE).map(bug => (
              <div key={bug.id} className="list-item"
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', borderLeft: bug.endDate && new Date(bug.endDate) < new Date() && !['Resolved', 'Closed'].includes(bug.status) ? '3px solid #ef4444' : undefined }}
                onMouseEnter={() => setHoveredBugId(bug.id)}
                onMouseLeave={() => setHoveredBugId(null)}
                onClick={(e) => {
                  if (e.target.type === 'checkbox') return;
                  setViewingBug(bug);
                  setIsDetailsOpen(true);
                }}>
                {/* Checkbox — only visible in selectionMode */}
                {selectionMode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: '16px', paddingLeft: '4px' }}>
                    <input
                      type="checkbox"
                      className="checkbox-pro"
                      checked={selectedBugs.has(bug.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedBugs);
                        if (e.target.checked) newSet.add(bug.id);
                        else newSet.delete(bug.id);
                        setSelectedBugs(newSet);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 5 }}>
                    {(() => {
                      let prs = [];
                      try {
                        const raw = bug.githubPr;
                        if (Array.isArray(raw)) prs = raw;
                        else if (typeof raw === 'string' && raw.startsWith('[')) prs = JSON.parse(raw);
                        else if (raw) prs = [raw];
                      } catch (e) { prs = []; }

                      return prs.filter(Boolean).map((pr, i) => (
                        <a key={`pr-${i}`} href={formatUrl(pr)} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ padding: '6px' }} onClick={(e) => e.stopPropagation()} title={`PR Link: ${pr}`}>
                          <Link2 size={14} />
                        </a>
                      ));
                    })()}
                    <button className="btn btn-outline" style={{ padding: '6px' }} onClick={(e) => handleEdit(bug, e)}><Edit3 size={14} /></button>
                    <button className="btn btn-outline btn-danger" style={{ padding: '6px' }} onClick={(e) => handleDelete(bug, e)}><Trash2 size={14} /></button>
                  </div>
                  <div className="item-header" style={{ marginBottom: '8px' }}>
                    <span className="badge badge-id">{getShortId(bug.id)}</span>
                    <span className={`badge ${getPriorityClass(bug.priority)}`} style={{ marginLeft: '6px' }}>{bug.priority}</span>
                    <span className="badge badge-status-pro" style={{ marginLeft: '6px' }}>{bug.status}</span>
                    <span className="badge badge-tag" style={{ marginLeft: '6px' }}>{bug.project || 'General'}</span>
                    {(() => {
                      let prs = [];
                      try {
                        if (Array.isArray(bug.githubPr)) prs = bug.githubPr;
                        else if (typeof bug.githubPr === 'string' && bug.githubPr.startsWith('[')) prs = JSON.parse(bug.githubPr);
                        else if (bug.githubPr) prs = [bug.githubPr];
                      } catch {}
                      const prWithStatus = prs.filter(Boolean).find(pr => prStatuses[pr]);
                      if (!prWithStatus) return null;
                      const s = prStatuses[prWithStatus];
                      const styles = {
                        merged: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                        open: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
                        closed: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
                      };
                      const c = styles[s.status] || styles.open;
                      return (
                        <span style={{
                          marginLeft: '6px', fontSize: '0.6rem', fontWeight: '800',
                          padding: '3px 8px', borderRadius: '10px',
                          backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
                          textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '3px'
                        }}>
                          PR: {s.label}
                        </span>
                      );
                    })()}
                    {bug.module && bug.module !== 'General' && bug.module !== 'Not Assigned' && (
                      <span className="badge badge-tag-pro" style={{ marginLeft: '6px', backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)', fontSize: '0.65rem' }}>
                        {getFullModulePath(bug)}
                      </span>
                    )}
                  </div>
                  <h3 className="item-title" style={{ fontSize: '1rem', fontWeight: '400' }}>{bug.title}</h3>
                  <p className="item-desc" style={{ fontSize: '0.86rem' }}>{bug.description}</p>
                  <div className="item-footer" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar" style={{ backgroundColor: '#6366f1', width: '22px', height: '22px', fontSize: '0.65rem' }}>{getInitials(bug.assignee)}</div>
                    <span style={{ fontWeight: '600' }}>{capitalizeName(toName(bug.assignee))}</span>
                    <span>Created {formatDate(bug.createdAt)}</span>
                    {bug.endDate && new Date(bug.endDate) < new Date() && !['Resolved', 'Closed'].includes(bug.status) && (
                      <span style={{ padding: '2px 8px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.65rem', fontWeight: '700', borderRadius: '6px', border: '1px solid #fecaca' }}>OVERDUE</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {/* Pagination */}
            {filteredBugs.length > BUGS_PER_PAGE && (() => {
              const totalPages = Math.ceil(filteredBugs.length / BUGS_PER_PAGE);
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0', marginTop: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--color-border)',
                      backgroundColor: currentPage === 1 ? '#f8fafc' : 'white', cursor: currentPage === 1 ? 'default' : 'pointer',
                      fontWeight: '600', fontSize: '0.8rem', color: currentPage === 1 ? '#cbd5e1' : '#475569'
                    }}
                  >Prev</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) => typeof p === 'string' ? (
                      <span key={`dot-${i}`} style={{ color: 'var(--color-text-light)', fontSize: '0.8rem' }}>{p}</span>
                    ) : (
                      <button key={p} onClick={() => setCurrentPage(p)} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        border: p === currentPage ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        backgroundColor: p === currentPage ? '#eff6ff' : 'white',
                        color: p === currentPage ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                      }}>{p}</button>
                    ))
                  }
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--color-border)',
                      backgroundColor: currentPage === totalPages ? '#f8fafc' : 'white', cursor: currentPage === totalPages ? 'default' : 'pointer',
                      fontWeight: '600', fontSize: '0.8rem', color: currentPage === totalPages ? '#cbd5e1' : '#475569'
                    }}
                  >Next</button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginLeft: '12px' }}>
                    {(currentPage - 1) * BUGS_PER_PAGE + 1}–{Math.min(currentPage * BUGS_PER_PAGE, filteredBugs.length)} of {filteredBugs.length}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        <BugDetails
          isOpen={isDetailsOpen}
          onClose={() => { setIsDetailsOpen(false); setViewingBug(null); }}
          onEdit={(bug) => handleEdit(bug, { stopPropagation: () => { } })}
          onStatusUpdate={(bug, newStatus, e) => {
            handleQuickUpdate(bug, { status: newStatus }, e);
            showToast("Status updated!");
          }}
          onNavigate={(bug) => setViewingBug(bug)}
          onQuickUpdate={handleQuickUpdate}
          bug={viewingBug}
          allBugs={bugs}
          settings={settings}
          showToast={showToast}
          currentReporter={currentReporter}
        />

        <BugForm
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingBug(null); }}
          onSave={handleSaveBug}
          settings={settings}
          initialData={editingBug}
          showToast={showToast}
          currentReporter={currentReporter}
          bugs={bugs}
          saving={saving}
        />

        {/* Delete Modal */}
        {deletingBug && (
          <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setDeletingBug(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '8px' }}>Delete Bug?</h3>
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  BUG-{String(deletingBug.id).split('-')[1]?.substring(0, 4)?.toUpperCase() || ''}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text-main)', wordBreak: 'break-word' }}>
                  {deletingBug.title}
                </div>
              </div>
              <p style={{ marginBottom: '28px', color: 'var(--color-text-muted)' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeletingBug(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', opacity: singleDeleting ? 0.7 : 1 }} onClick={confirmDelete} disabled={singleDeleting}>{singleDeleting ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        <div style={{
          position: 'fixed', bottom: '32px', right: '32px', backgroundColor: 'var(--color-bg-surface)', padding: '12px 24px', borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', zIndex: 9999, transition: 'all 0.3s',
          transform: toast.visible ? 'translateY(0)' : 'translateY(100px)', opacity: toast.visible ? 1 : 0
        }}>
          {toast.message}
        </div>

        {/* Undo Delete Toast */}
        {undoDelete && (
          <div style={{
            position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-main)',
            padding: '14px 24px', borderRadius: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid var(--color-border)',
            zIndex: 10000, display: 'flex', alignItems: 'center', gap: '16px',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{undoDelete.shortId} deleted</span>
            <button onClick={handleUndo} style={{
              padding: '6px 16px', borderRadius: '8px', border: 'none',
              backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: '800',
              fontSize: '0.8rem', cursor: 'pointer'
            }}>Undo</button>
          </div>
        )}

        {/* Floating Bulk Action Bar */}
        {selectedBugs.size > 0 && (
          <div id="bulk-action-area">
            {/* Selected Bugs Popup List */}
            {showSelectionPopup && (
              <div style={{
                position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'var(--color-bg-surface)', borderRadius: '16px',
                border: '1px solid var(--color-border)', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(16px)', zIndex: 7001,
                minWidth: '320px', maxWidth: '480px', maxHeight: '260px',
                overflowY: 'auto', padding: '8px',
                animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}>
                {bugs.filter(b => selectedBugs.has(b.id)).map(b => (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 12px', borderRadius: '10px', transition: 'background 0.15s'
                  }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-primary)',
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))', padding: '2px 8px', borderRadius: '99px',
                      border: '1px solid #bfdbfe', whiteSpace: 'nowrap', flexShrink: 0
                    }}>{b.id}</span>
                    <span style={{
                      fontSize: '0.88rem', color: 'var(--color-text-main)', fontWeight: '600', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{b.title}</span>
                    <button onClick={() => {
                      const newSet = new Set(selectedBugs);
                      newSet.delete(b.id);
                      setSelectedBugs(newSet);
                      if (newSet.size === 0) setShowSelectionPopup(false);
                    }} style={{ flexShrink: 0, color: 'var(--color-text-light)', padding: '4px', borderRadius: '6px', lineHeight: 1 }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Centered Action Bar Container */}
            {selectionMode && selectedBugs.size > 0 && (
              <div style={{
                position: 'fixed', bottom: '40px', left: '260px', right: '0',
                display: 'flex', justifyContent: 'center', zIndex: 7000, pointerEvents: 'none'
              }}>
                <div style={{
                  backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-main)', padding: '12px 24px', borderRadius: '20px',
                  display: 'flex', alignItems: 'center', gap: '20px', pointerEvents: 'auto',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.02)',
                  animation: 'popIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}>
                  <span onClick={() => setShowSelectionPopup(v => !v)} style={{
                    fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '10px',
                    cursor: 'pointer', userSelect: 'none'
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '24px', height: '24px', borderRadius: '8px',
                      backgroundColor: '#2563eb', color: 'white',
                      fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(37,99,235,0.3)'
                    }}>
                      {selectedBugs.size}
                    </div>
                    Selected
                    <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', transform: showSelectionPopup ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                  </span>
                  <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                  <button style={{
                    color: '#ef4444', fontWeight: '700', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, #ef4444 12%, var(--color-bg-surface))', transition: 'all 0.2s', border: '1px solid color-mix(in srgb, #ef4444 25%, var(--color-bg-surface))'
                  , opacity: bulkDeleting ? 0.7 : 1}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #ef4444 22%, var(--color-bg-surface))'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #ef4444 12%, var(--color-bg-surface))'} onClick={handleBulkDelete} disabled={bulkDeleting}>
                    <Trash2 size={16} /> {bulkDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button style={{
                    color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: '600',
                    padding: '6px 12px', borderRadius: '10px', transition: 'all 0.2s'
                  }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-text-main) 8%, var(--color-bg-surface))'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} onClick={() => { setSelectedBugs(new Set()); setShowSelectionPopup(false); setSelectionMode(false); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>{/* end scrollable list */}
      <style jsx>{`
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: white;
          border: 1px solid #e2e8f0;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: all 0.2s;
        }
        .filter-chip button {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: color 0.2s;
        }
        .filter-chip button:hover {
          color: #ef4444;
        }
        .clear-all-btn {
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #ef4444;
          background-color: #fef2f2;
          border: 1px solid #fee2e2;
          cursor: pointer;
          transition: all 0.2s;
        }
        .clear-all-btn:hover {
          background-color: #fee2e2;
          border-color: #fecaca;
        }
        .custom-dropdown-trigger.active {
          border-color: var(--color-primary);
          background-color: #eff6ff;
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}

export default function BugManagementPage() {
  return (
    <Suspense fallback={<LoadingOverlay message="Loading Modules" subtext="Preparing project-specific components..." />}>
      <BugManagement />
    </Suspense>
  );
}
