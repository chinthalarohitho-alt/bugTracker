"use client";
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Plus, Bug as BugIcon, Edit3, Trash2, Search, Download, Link2, ChevronDown, Check, X, Bell, ExternalLink, MailOpen, Calendar, ArrowUpDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import BugForm from '../components/BugForm';
import BugDetails from '../components/BugDetails';
import CustomDropdown from '../components/CustomDropdown';
import { useAuth } from '../components/AuthProvider';
import GlobalHeader from '../components/GlobalHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import AdvancedDateFilter from '../components/AdvancedDateFilter';


function BugManagement() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project');

  const [bugs, setBugs] = useState([]);
  const [filteredBugs, setFilteredBugs] = useState([]);
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
        if (a !== "Not Assigned" && a !== "Unassigned") names.add(a);
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
      fetch('/api/bugs').then(res => res.json()),
      fetch('/api/settings').then(res => res.json())
    ]).then(([bugsData, settingsData]) => {
      const arr = Array.isArray(bugsData) ? bugsData : (bugsData.bugs || []);
      setBugs(arr);
      setSettings(settingsData);
      setLoading(false);

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
    if (selectedAssignee.length > 0) result = result.filter(b => selectedAssignee.includes(b.assignee));
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
  }, [bugs, selectedProjects, selectedStatus, selectedPriority, selectedAssignee, selectedReporter, globalSearchQuery, startDate, endDate, sortOrder]);

  const handleSaveBug = async (bugData, isNew) => {
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
  };

  const handleDelete = (bug, e) => {
    e.stopPropagation();
    setDeletingBug(bug);
  };

  const confirmDelete = async () => {
    if (!deletingBug) return;
    const res = await fetch('/api/bugs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deletingBug.id })
    });
    if (res.ok) {
      setBugs(bugs.filter(b => b.id !== deletingBug.id));
      showToast(`BUG-${String(deletingBug.id).split('-')[1]?.substring(0, 4)?.toUpperCase() || ''} deleted successfully!`);
      if (selectedBugs.has(deletingBug.id)) {
        const newSel = new Set(selectedBugs);
        newSel.delete(deletingBug.id);
        setSelectedBugs(newSel);
      }
    }
    setDeletingBug(null);
  };

  const handleBulkDelete = async () => {
    if (selectedBugs.size === 0) return;
    const idsToDelete = Array.from(selectedBugs);

    // Optimistic UI update
    setBugs(bugs.filter(b => !selectedBugs.has(b.id)));
    setSelectedBugs(new Set());

    const res = await fetch('/api/bugs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`${result.deletedCount || idsToDelete.length} bugs permanently deleted!`);
    } else {
      showToast("Failed to delete all bugs.");
      // In production we would restore the bugs here if it completely fails
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
    const res = await fetch('/api/bugs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedBug)
    });
    const result = await res.json();
    if (result.success) {
      setBugs(bugs.map(b => b.id === bug.id ? result.bug : b));
      if (viewingBug && viewingBug.id === bug.id) {
        setViewingBug(result.bug);
      }
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

  const getInitials = (name) => {
    if (!name || name === 'Unassigned' || name === 'Not Assigned') return 'UN';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
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
    showToast(`Exported ${filteredBugs.length} bug(s) to CSV (Oldest first)!`);
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
        backgroundColor: 'rgba(241, 245, 249, 0.9)', // var(--color-bg-body) with alpha
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '0', letterSpacing: '-0.02em' }}>
                {selectedProjects.length === 1 ? `${selectedProjects[0]} Bugs` : 'Bug Management'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-primary)', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700' }}>
                  {filteredBugs.length} Total
                </span>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>Track, manage, and resolve bugs across projects</p>
          </div>

          <button
            className="btn btn-primary"
            style={{ height: '42px', padding: '0 20px', borderRadius: '12px', fontWeight: '700', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => { setEditingBug(null); setIsFormOpen(true); }}
          >
            <Plus size={18} strokeWidth={2.5} /> Create Bug
          </button>
        </div>

        <div className="filter-bar-group" style={{ marginBottom: '16px', width: 'auto', display: 'inline-flex' }}>
          <CustomDropdown label="All Reporter" options={reporterOptions} selected={selectedReporter} onSelect={(val) => toggleFilter(selectedReporter, setSelectedReporter, val)} isMulti />
          <CustomDropdown label="All Project" options={settings.projects} selected={selectedProjects} onSelect={(val) => toggleFilter(selectedProjects, setSelectedProjects, val)} isMulti />
          <CustomDropdown label="All Status" options={settings.statuses} selected={selectedStatus} onSelect={(val) => toggleFilter(selectedStatus, setSelectedStatus, val)} isMulti />
          <CustomDropdown label="All Priority" options={settings.priorities} selected={selectedPriority} onSelect={(val) => toggleFilter(selectedPriority, setSelectedPriority, val)} isMulti />
          <CustomDropdown label="All Assignee" options={settings.assignees} selected={selectedAssignee} onSelect={(val) => toggleFilter(selectedAssignee, setSelectedAssignee, val)} isMulti />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', paddingLeft: '12px', borderLeft: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-outline"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              style={{ height: '36px', padding: '0 12px', background: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: '700', color: 'var(--color-primary)', borderRadius: '8px' }}
              title={sortOrder === 'desc' ? "Newest First" : "Oldest First"}
            >
              <ArrowUpDown size={15} /> {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </button>

            <button 
              className="btn btn-outline" 
              style={{ height: '36px', padding: '0 12px', background: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: '700', borderRadius: '8px' }} 
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
              height: '38px', padding: '0 16px', background: selectionMode ? '#fef2f2' : 'white',
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
            <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No bugs found!</h2>
          </div>
        ) : (
          <div>
            {filteredBugs.map(bug => (
              <div key={bug.id} className="list-item"
                style={{ position: 'relative', cursor: 'pointer', display: 'flex' }}
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
                    {bug.module && bug.module !== 'General' && bug.module !== 'Not Assigned' && (
                      <span className="badge badge-tag-pro" style={{ marginLeft: '6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.65rem' }}>
                        {getFullModulePath(bug)}
                      </span>
                    )}
                  </div>
                  <h3 className="item-title" style={{ fontSize: '1rem', fontWeight: '400' }}>{bug.title}</h3>
                  <p className="item-desc" style={{ fontSize: '0.86rem' }}>{bug.description}</p>
                  <div className="item-footer" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar" style={{ backgroundColor: '#6366f1', width: '22px', height: '22px', fontSize: '0.65rem' }}>{getInitials(bug.assignee)}</div>
                    <span style={{ fontWeight: '600' }}>{bug.assignee}</span>
                    <span>Created {formatDate(bug.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
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
        />

        {/* Delete Modal */}
        {deletingBug && (
          <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setDeletingBug(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '8px' }}>Delete Bug?</h3>
              <p style={{ marginBottom: '28px', color: 'var(--color-text-muted)' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeletingBug(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1, backgroundColor: '#ef4444', color: 'white' }} onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        <div style={{
          position: 'fixed', bottom: '32px', right: '32px', backgroundColor: 'white', padding: '12px 24px', borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', zIndex: 9999, transition: 'all 0.3s',
          transform: toast.visible ? 'translateY(0)' : 'translateY(100px)', opacity: toast.visible ? 1 : 0
        }}>
          {toast.message}
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedBugs.size > 0 && (
          <div id="bulk-action-area">
            {/* Selected Bugs Popup List */}
            {showSelectionPopup && (
              <div style={{
                position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '16px',
                border: '1px solid #e2e8f0', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15)',
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
                      backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '99px',
                      border: '1px solid #bfdbfe', whiteSpace: 'nowrap', flexShrink: 0
                    }}>{b.id}</span>
                    <span style={{
                      fontSize: '0.88rem', color: '#1e293b', fontWeight: '600', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{b.title}</span>
                    <button onClick={() => {
                      const newSet = new Set(selectedBugs);
                      newSet.delete(b.id);
                      setSelectedBugs(newSet);
                      if (newSet.size === 0) setShowSelectionPopup(false);
                    }} style={{ flexShrink: 0, color: '#94a3b8', padding: '4px', borderRadius: '6px', lineHeight: 1 }}
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
                  backgroundColor: 'rgba(255, 255, 255, 0.85)', color: '#0f172a', padding: '12px 24px', borderRadius: '20px',
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
                      backgroundColor: 'var(--color-primary)', color: 'white',
                      fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(37,99,235,0.3)'
                    }}>
                      {selectedBugs.size}
                    </div>
                    Selected
                    <ChevronDown size={14} style={{ color: '#64748b', transform: showSelectionPopup ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                  </span>
                  <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>
                  <button style={{
                    color: '#ef4444', fontWeight: '700', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '10px',
                    backgroundColor: '#fef2f2', transition: 'all 0.2s', border: '1px solid #fee2e2'
                  }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'} onClick={handleBulkDelete}>
                    <Trash2 size={16} /> Delete
                  </button>
                  <button style={{
                    color: '#64748b', fontSize: '0.9rem', fontWeight: '600',
                    padding: '6px 12px', borderRadius: '10px', transition: 'all 0.2s'
                  }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} onClick={() => { setSelectedBugs(new Set()); setShowSelectionPopup(false); setSelectionMode(false); }}>
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
