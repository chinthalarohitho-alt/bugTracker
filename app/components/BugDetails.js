"use client";
import { useState, useEffect } from 'react';
import { X, Calendar, User, Tag, AlertCircle, HardDrive, CheckSquare, List, ChevronRight, Edit, Link2, Clock, Trash2, Pencil, Copy, ExternalLink, Eye, Check, XCircle, Save, RotateCcw, MessageSquare, History, ArrowRight, Plus, Trash } from 'lucide-react';
import CustomDropdown from './CustomDropdown';
import { capitalizeName } from './AuthProvider';

export default function BugDetails({ isOpen, onClose, onEdit, onStatusUpdate, onQuickUpdate, onNavigate, bug, allBugs = [], settings, showToast, currentReporter }) {

  const [viewingCurl, setViewingCurl] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [tempValues, setTempValues] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [prStatuses, setPrStatuses] = useState({});

  useEffect(() => {
    setTempValues({});
    setEditingField(null);
    setViewingCurl(null);
    setShowConfirmModal(false);
    setPendingNavigation(null);
    setPrStatuses({});
  }, [bug?.id]);

  // Fetch GitHub PR statuses
  useEffect(() => {
    if (!bug) return;
    const prs = (() => {
      if (Array.isArray(bug.githubPr)) return bug.githubPr;
      if (typeof bug.githubPr === 'string' && bug.githubPr.startsWith('[')) { try { return JSON.parse(bug.githubPr); } catch { return []; } }
      return bug.githubPr ? [bug.githubPr] : [];
    })();
    const githubPrs = prs.filter(pr => pr && pr.includes('github.com') && pr.includes('/pull/'));
    if (githubPrs.length === 0) return;

    fetch('/api/github/pr-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: githubPrs })
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
  }, [bug?.id, bug?.githubPr]);

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

  const getModulesForProject = (proj) => {
    return PROJECT_MODULES[proj] || ["General", "Authentication", "Database", "UI/UX", "API"];
  };

  const getFullModulePath = (proj, mod) => {
    if (!mod || mod === 'General' || mod === 'Not Assigned') return 'General';
    const modules = PROJECT_MODULES[proj || "Pharmacy ERP"] || [];
    
    if (mod.startsWith(' -')) {
      const cleanChild = mod.substring(2);
      const idx = modules.indexOf(mod);
      if (idx !== -1) {
        for (let i = idx - 1; i >= 0; i--) {
          if (!modules[i].startsWith(' -')) {
            return `${modules[i]} → ${cleanChild}`;
          }
        }
      }
      return cleanChild;
    }
    return mod;
  };

  const getAssigneeName = (a) => {
    if (typeof a === 'object' && a !== null) return a.name || '';
    if (typeof a === 'string' && a.startsWith('{')) { try { return JSON.parse(a).name || a; } catch { return a; } }
    return a || '';
  };
  const assigneeNames = (settings.assignees || []).map(a => getAssigneeName(a));

  if (!isOpen || !bug) return null;

  // Detect unsaved changes (only if value actually differs from original)
  const actualChanges = Object.keys(tempValues).filter(key => {
    const newVal = tempValues[key];
    const oldVal = bug[key];
    
    if (key === 'curls') {
      let oldCurls = [];
      if (Array.isArray(bug.curls)) oldCurls = bug.curls;
      else if (typeof bug.curls === 'string' && bug.curls.startsWith('[')) { try { oldCurls = JSON.parse(bug.curls); } catch(e) {} }
      else if (bug.curl) oldCurls = [bug.curl];
      return JSON.stringify(newVal) !== JSON.stringify(oldCurls);
    }
    
    if (key === 'githubPr') {
      let oldPrs = [];
      if (Array.isArray(bug.githubPr)) oldPrs = bug.githubPr;
      else if (typeof bug.githubPr === 'string' && bug.githubPr.startsWith('[')) { try { oldPrs = JSON.parse(bug.githubPr); } catch(e) {} }
      else if (bug.githubPr) oldPrs = [bug.githubPr];
      return JSON.stringify(newVal) !== JSON.stringify(oldPrs);
    }

    return newVal !== oldVal;
  });
  const hasChanges = actualChanges.length > 0;

  const handleSaveAll = (closeAfterSave = false) => {
    const isExplicitClose = closeAfterSave === true;

    if (actualChanges.length === 0) {
      if (isExplicitClose && !pendingNavigation) onClose();
      return;
    }
    
    // Only save the fields that actually changed
    const finalChanges = {};
    actualChanges.forEach(k => {
      // Map pseudo-keys or arrays to their stringified backend representations
      if (k === 'curl') {
        finalChanges['curl'] = tempValues[k];
      } else if (k === 'githubPr') {
        finalChanges['githubPr'] = tempValues[k];
      } else {
        finalChanges[k] = tempValues[k];
      }
    });
    
    onQuickUpdate(bug, finalChanges);
    setTempValues({});
    setEditingField(null);
    setShowConfirmModal(false);
    showToast(`${getShortId(bug.id)} updated successfully!`);
    
    if (pendingNavigation) {
      onNavigate(pendingNavigation);
      setPendingNavigation(null);
    } else if (isExplicitClose) {
      onClose(); // Standard save/close
    }
  };

  const handleDiscard = () => {
    setTempValues({});
    setEditingField(null);
    setShowConfirmModal(false);
    if (pendingNavigation) {
      onNavigate(pendingNavigation);
      setPendingNavigation(null);
    } else {
      onClose(); // Default discard/close
    }
  };

  const attemptClose = () => {
    if (hasChanges) {
      setShowConfirmModal(true);
      setPendingNavigation(null);
    } else {
      onClose();
    }
  };

  const attemptNavigate = (targetBug) => {
    if (hasChanges) {
      setPendingNavigation(targetBug);
      setShowConfirmModal(true);
    } else {
      onNavigate(targetBug);
    }
  };

  const startEdit = (field, currentVal) => {
    setEditingField(field);
    if (tempValues[field] === undefined) {
      setTempValues({ ...tempValues, [field]: currentVal || '' });
    }
  };

  const updateTempValue = (field, val) => {
    setTempValues(prev => ({ ...prev, [field]: val }));
  };

  const getInitials = (val) => {
    const name = getAssigneeName(val);
    if (!name || name === 'Unassigned' || name === 'Not Assigned') return 'UN';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      default: return 'badge-low';
    }
  };

  const formatDate = (dateInput) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) return date.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Fallback for Excel numerical dates (days since 1900)
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const convertedDate = new Date(excelEpoch.getTime() + dateInput * 86400000);
      return convertedDate.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' at ' + convertedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return 'Invalid Date';
  };

  const getShortId = (uuid) => {
    if (!uuid) return "BUG-X";
    if (String(uuid).startsWith("BUG-")) return uuid;
    const segment = String(uuid).split('-')[0] || "X";
    return `BUG-${segment.substring(0,4).toUpperCase()}`;
  };

  // Helper for multi-CURL support
  const getCurlsArray = () => {
    if (tempValues.curl !== undefined) return tempValues.curl;
    const raw = bug.curl;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.startsWith('[')) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return raw ? [raw] : [];
  };

  const addCurl = () => {
    const current = getCurlsArray();
    const updated = [...current, ''];
    updateTempValue('curl', updated);
    setEditingField(`curl-${updated.length - 1}`);
  };

  const removeCurl = (idx) => {
    const current = getCurlsArray();
    const updated = current.filter((_, i) => i !== idx);
    updateTempValue('curl', updated);
  };

  const updateCurlValue = (idx, val) => {
    const current = getCurlsArray();
    const updated = [...current];
    updated[idx] = val;
    updateTempValue('curl', updated);
  };

  // Helper for multi-PR support
  const getPrsArray = () => {
    if (tempValues.githubPr !== undefined) return tempValues.githubPr;
    const raw = bug.githubPr;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.startsWith('[')) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    // Legacy support: convert single bug.githubPr string to an array [bug.githubPr]
    if (bug.githubPr && typeof bug.githubPr === 'string') return [bug.githubPr];
    return [];
  };

  const addPr = () => {
    const current = getPrsArray();
    const updated = [...current, ''];
    updateTempValue('githubPr', updated);
    setEditingField(`pr-${updated.length - 1}`);
  };

  const removePr = (idx) => {
    const current = getPrsArray();
    const updated = current.filter((_, i) => i !== idx);
    updateTempValue('githubPr', updated);
  };

  const updatePrValue = (idx, val) => {
    const current = getPrsArray();
    const updated = [...current];
    updated[idx] = val;
    updateTempValue('githubPr', updated);
  };

  const restoreLogValue = (item, target) => {
    let val = target === 'from' ? item.from : item.to;
    if (val === '—') val = '';
    
    let fieldKey = item.fieldKey;
    if (!fieldKey && item.action) {
      const a = item.action.toLowerCase();
      if (a.startsWith('title ')) fieldKey = 'title';
      else if (a.startsWith('description ')) fieldKey = 'description';
      else if (a.startsWith('reproduction steps ') || a.startsWith('steps to reproduce ')) fieldKey = 'stepsToReproduce';
      else if (a.startsWith('expected result ')) fieldKey = 'expectedResult';
      else if (a.startsWith('actual result ')) fieldKey = 'actualResult';
      else if (a.startsWith('status ')) fieldKey = 'status';
      else if (a.startsWith('assignee ')) fieldKey = 'assignee';
      else if (a.startsWith('priority ')) fieldKey = 'priority';
      else if (a.startsWith('severity ')) fieldKey = 'severity';
      else if (a.startsWith('project ')) fieldKey = 'project';
      else if (a.startsWith('module ')) fieldKey = 'module';
      else if (a.startsWith('start date ')) fieldKey = 'startDate';
      else if (a.startsWith('end date ')) fieldKey = 'endDate';
      else if (a.startsWith('github pr ')) fieldKey = 'githubPr';
      else if (a.startsWith('curl ')) fieldKey = 'curls';
    }
    
    if (fieldKey) {
      if (typeof val === 'string' && val.endsWith('…')) {
        showToast("Cannot restore partially truncated legacy log!");
        return;
      }
      if (fieldKey === 'githubPr' || fieldKey === 'curls') {
        try {
           const arr = JSON.parse(val);
           if (Array.isArray(arr)) {
              updateTempValue(fieldKey, arr);
              showToast(`Restored ${fieldKey}!`);
              return;
           }
        } catch(e) {}
        updateTempValue(fieldKey, val ? [val] : []); 
      } else {
        updateTempValue(fieldKey, val);
      }
      showToast(`Restored ${fieldKey}!`);
    } else {
      showToast("Could not match field for restoration.");
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    let currentComments = [];
    try {
      const raw = bug.comments;
      if (Array.isArray(raw)) currentComments = raw;
      else if (typeof raw === 'string' && raw.startsWith('[')) currentComments = JSON.parse(raw);
    } catch(e) { currentComments = []; }

    const commentObj = {
      id: Date.now(),
      author: currentReporter || 'System',
      text: newComment,
      date: new Date().toISOString()
    };

    const updatedComments = [...currentComments, commentObj];
    onQuickUpdate(bug, { comments: JSON.stringify(updatedComments) });
    
    // Trigger Notifications for Mentions
    const mentions = newComment.match(/@(\w+)/g);
    if (mentions) {
      const uniqueMentions = [...new Set(mentions.map(m => m.substring(1)))];
      uniqueMentions.forEach(async (targetUser) => {
        // Match exact name or first name of a multi-word name
        const matchedUser = assigneeNames.find(a =>
          a.toLowerCase() === targetUser.toLowerCase() ||
          a.split(' ')[0].toLowerCase() === targetUser.toLowerCase()
        );
        if (matchedUser && matchedUser !== currentReporter) {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetUser: matchedUser,
              actor: currentReporter,
              bugId: bug.id,
              message: newComment
            })
          });
        }
      });
    }

    setNewComment("");
    showToast("Review comment posted!");
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setNewComment(val);

    const lastChar = val[pos - 1];
    const textBefore = val.substring(0, pos);
    const words = textBefore.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionSearch(lastWord.substring(1));
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user) => {
    const pos = document.getElementById('comment-textarea').selectionStart;
    const textBefore = newComment.substring(0, pos);
    const textAfter = newComment.substring(pos);
    const words = textBefore.split(/\s/);
    words[words.length - 1] = `@${user} `;
    setNewComment(words.join(' ') + textAfter);
    setShowMentions(false);
    document.getElementById('comment-textarea').focus();
  };

  const formatComment = (text) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        return (
          <span key={i} style={{ 
            color: 'var(--color-primary)', 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            fontWeight: '600',
            fontSize: '0.85rem'
          }}>@{username}</span>
        );
      }
      return part;
    });
  };

  return (
    <div className="drawer-overlay" style={{ zIndex: 8000 }} onClick={attemptClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div className="drawer-header" style={{ padding: '20px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasChanges ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.2s' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unsaved edits...</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleSaveAll(false)} style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '700', borderRadius: '6px', backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={12} /> Save</button>
                  <button onClick={() => { setTempValues({}); setEditingField(null); }} style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '700', borderRadius: '6px', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><RotateCcw size={12} /> Revert</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>
                <span>{bug.project || 'General'}</span>
                <ChevronRight size={14} />
                <span style={{ fontFamily: 'monospace', color: 'var(--color-text-main)', fontWeight: '500' }}>{getShortId(bug.id)}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {editingField === 'status' ? (
              <CustomDropdown 
                options={settings?.statuses}
                selected={tempValues.status !== undefined ? tempValues.status : bug.status}
                onSelect={(val) => updateTempValue('status', val)}
                placeholder="Status"
                style={{ marginRight: '8px' }}
              />
            ) : (
              <span onDoubleClick={() => startEdit('status', bug.status)} className="badge badge-status-pro" style={{ cursor: 'pointer', marginRight: '8px' }}>{tempValues.status !== undefined ? tempValues.status : bug.status}</span>
            )}

            <button type="button" className="icon-action-btn" title="Form View" onClick={(e) => { e.stopPropagation(); onEdit(bug); }}><Edit size={18} /></button>
            <button type="button" className="icon-action-btn" title="Copy Link" onClick={(e) => { 
                e.stopPropagation(); 
                const link = `${window.location.origin}${window.location.pathname}?bug=${bug.id}`; 
                navigator.clipboard.writeText(link); 
                showToast(`Copied Link for ${bug.id}!`); 
            }}><Link2 size={18} /></button>
            <button type="button" className="icon-action-btn" onClick={(e) => { e.stopPropagation(); attemptClose(); }}><X size={20} /></button>
          </div>
        </div>

        <div className="drawer-body">
          <div className="drawer-main" style={{ flex: 1, padding: '32px', overflowY: 'auto', borderRight: '1px solid var(--color-border-light)', cursor: 'default' }}>
            {editingField === 'title' ? (
              <input autoFocus className="inline-edit-input" style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '24px', width: '100%', padding: '4px 8px', borderRadius: '8px', border: '2px solid var(--color-primary)', outline: 'none' }} value={tempValues.title !== undefined ? tempValues.title : bug.title} onChange={(e) => updateTempValue('title', e.target.value)} onBlur={() => setEditingField(null)} onKeyDown={(e) => { if(e.key === 'Enter') setEditingField(null); }} />
            ) : (
              <h2 onDoubleClick={() => startEdit('title', bug.title)} className="hover-editable-field" style={{ fontSize: '1.75rem', fontWeight: '600', color: 'var(--color-text-main)', marginBottom: '24px', lineHeight: '1.2', cursor: 'text', border: '1px solid transparent', padding: '4px 0' }}>{tempValues.title !== undefined ? tempValues.title : bug.title}</h2>
            )}

            <div style={{ marginBottom: '40px' }}><h4 className="meta-label"><Tag size={14} /> Description</h4> {editingField === 'description' ? ( <textarea autoFocus className="inline-edit-input" style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-primary)', fontSize: '1.05rem', lineHeight: '1.65', outline: 'none' }} value={tempValues.description !== undefined ? tempValues.description : bug.description} onChange={(e) => updateTempValue('description', e.target.value)} onBlur={() => setEditingField(null)} /> ) : ( <div onDoubleClick={() => startEdit('description', bug.description)} className="hover-editable-field" style={{ fontSize: '1.05rem', color: 'var(--color-text-main)', lineHeight: '1.65', whiteSpace: 'pre-wrap', cursor: 'text', border: '1px solid transparent', padding: '8px 0', minHeight: '20px' }}> {tempValues.description !== undefined ? tempValues.description : (bug.description || 'Add description...')} </div> )} </div>             <div style={{ marginBottom: '40px' }}><h4 className="meta-label"><List size={14} /> Steps to Reproduce</h4> {editingField === 'stepsToReproduce' ? ( <textarea autoFocus className="inline-edit-input" style={{ width: '100%', minHeight: '150px', padding: '16px', borderRadius: '10px', border: '1px solid var(--color-primary)', fontSize: '0.95rem', lineHeight: '1.8', outline: 'none' }} value={tempValues.stepsToReproduce !== undefined ? tempValues.stepsToReproduce : bug.stepsToReproduce} onChange={(e) => updateTempValue('stepsToReproduce', e.target.value)} onBlur={() => setEditingField(null)} /> ) : ( <div onDoubleClick={() => startEdit('stepsToReproduce', bug.stepsToReproduce)} className="hover-editable-field" style={{ backgroundColor: 'var(--color-bg-body)', padding: '24px', borderRadius: '12px', fontSize: '0.95rem', border: '1px solid var(--color-border-light)', lineHeight: '1.8', color: 'var(--color-text-main)', cursor: 'text' }}> {(() => { const text = tempValues.stepsToReproduce !== undefined ? tempValues.stepsToReproduce : (bug.stepsToReproduce || ''); if (!text) return <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>Double-click to add steps.</span>; const parts = text.split(/(\d+)\s*[.:)-]\s*/g); if (parts.length === 1) return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>; const steps = []; if (parts[0].trim()) steps.push({ num: 1, content: parts[0].trim() }); for (let i = 1; i < parts.length; i += 2) { const num = parts[i]; const content = parts[i + 1] || ""; if (content.trim()) steps.push({ num, content: content.trim() }); } return steps.map((s, idx) => ( <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: idx === steps.length - 1 ? 0 : '12px' }}> <span style={{ fontWeight: '600', color: 'inherit', minWidth: '18px', flexShrink: 0, textAlign: 'right' }}>{s.num}.</span> <span style={{ whiteSpace: 'pre-wrap' }}>{s.content}</span> </div> )); })()} </div> )} </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
              <div style={{ backgroundColor: 'var(--color-bg-body)', padding: '16px', borderRadius: '12px', borderLeft: '4px solid var(--color-primary)' }}>
                <h4 className="meta-label">Expected Result</h4> {editingField === 'expectedResult' ? ( <textarea autoFocus style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-primary)', outline: 'none', fontSize: '0.9rem' }} value={tempValues.expectedResult !== undefined ? tempValues.expectedResult : bug.expectedResult} onChange={(e) => updateTempValue('expectedResult', e.target.value)} onBlur={() => setEditingField(null)} /> ) : ( <div onDoubleClick={() => startEdit('expectedResult', bug.expectedResult)} className="hover-editable-field" style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', minHeight: '16px', padding: '8px 0' }}> {tempValues.expectedResult !== undefined ? tempValues.expectedResult : (bug.expectedResult || '—')} </div> )} 
              </div>
              <div style={{ backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--color-bg-surface))', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #ef4444' }}> <h4 className="meta-label" style={{ color: '#ef4444' }}><AlertCircle size={12} /> Actual Result</h4> {editingField === 'actualResult' ? ( <textarea autoFocus style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', outline: 'none', fontSize: '0.9rem' }} value={tempValues.actualResult !== undefined ? tempValues.actualResult : bug.actualResult} onChange={(e) => updateTempValue('actualResult', e.target.value)} onBlur={() => setEditingField(null)} /> ) : ( <div onDoubleClick={() => startEdit('actualResult', bug.actualResult)} className="hover-editable-field" style={{ fontSize: '0.95rem', color: '#ef4444', fontWeight: '500', minHeight: '16px', padding: '8px 0' }}> {tempValues.actualResult !== undefined ? tempValues.actualResult : (bug.actualResult || '—')} </div> )} </div>
            </div>

            {/* TECHNICAL CONTEXT - MINIMALIST RESTORATION */}
            <div style={{ backgroundColor: 'var(--color-bg-body)', padding: '24px', borderRadius: '16px', marginBottom: '40px' }}>
               <h4 className="meta-label" style={{ marginBottom: '16px', color: 'var(--color-text-muted)', fontWeight: '700' }}><HardDrive size={14} /> Technical Context</h4>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                 <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>GitHub PR Links</div>
                 <button onClick={addPr} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: '700', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                    <Plus size={12} /> Add PR
                 </button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                  {getPrsArray().map((pr, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {editingField === `pr-${idx}` ? (
                        <input autoFocus style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-primary)', outline: 'none', fontSize: '0.9rem' }} value={pr} onChange={(e) => updatePrValue(idx, e.target.value)} onBlur={() => setEditingField(null)} onKeyDown={(e) => { if(e.key === 'Enter') setEditingField(null); }} />
                      ) : (
                        <div style={{ display: 'flex', flex: 1, gap: '8px', alignItems: 'center' }}>
                          <div 
                            onClick={(e) => {
                              if (!pr) return;
                              if (window.prClickTimer) clearTimeout(window.prClickTimer);
                              if (e.detail === 1) {
                                  window.prClickTimer = setTimeout(() => {
                                      window.open(pr.startsWith('http') ? pr : `https://${pr}`, '_blank');
                                  }, 250);
                              }
                            }}
                            onDoubleClick={(e) => {
                              if (window.prClickTimer) clearTimeout(window.prClickTimer);
                              setEditingField(`pr-${idx}`);
                            }}
                            style={ pr 
                              ? { fontSize: '0.75rem', color: 'var(--color-primary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '6px 14px', borderRadius: '20px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content', border: '1px solid rgba(59, 130, 246, 0.2)' }
                              : { fontSize: '0.75rem', color: 'var(--color-text-muted)', backgroundColor: 'transparent', padding: '6px 14px', borderRadius: '20px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content', border: '1px dashed #cbd5e1' }
                            }
                            title={pr}>
                            <Link2 size={14} />
                            {pr ? `PR ${idx + 1}` : '+ Add GitHub PR'}
                            {pr && prStatuses[pr] && (() => {
                              const s = prStatuses[pr];
                              const colors = {
                                merged: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: '✓' },
                                open: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '●' },
                                closed: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '✕' },
                                not_found: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', icon: '?' },
                                error: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', icon: '!' },
                                invalid: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', icon: '—' },
                              };
                              const c = colors[s.status] || colors.error;
                              return (
                                <span title={s.title || s.label} style={{
                                  fontSize: '0.6rem', fontWeight: '800', padding: '2px 8px',
                                  borderRadius: '10px', backgroundColor: c.bg, color: c.color,
                                  border: `1px solid ${c.border}`, textTransform: 'uppercase',
                                  display: 'inline-flex', alignItems: 'center', gap: '3px'
                                }}>
                                  {c.icon} {s.label}
                                </span>
                              );
                            })()}
                          </div>
                          <button onClick={() => removePr(idx)} className="icon-action-btn" style={{ color: '#ef4444' }} title="Remove PR"><Trash size={14} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {getPrsArray().length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic', padding: '4px' }}>No PR links added.</div>
                  )}
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                 <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Reproduction Repository (CURLs)</div>
                 <button onClick={addCurl} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: '800', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                    <Plus size={12} /> Add CURL
                 </button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px' }}>
                  {getCurlsArray().map((curl, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-bg-surface)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--color-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', width: 'fit-content' }}>
                       <div style={{ minWidth: 0 }}>
                          {editingField === `curl-${idx}` ? (
                            <textarea autoFocus style={{ width: '200px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--color-primary)', outline: 'none', fontSize: '0.75rem', fontFamily: 'monospace', height: '60px', wordBreak: 'break-all' }} value={curl} onChange={(e) => updateCurlValue(idx, e.target.value)} onBlur={() => setEditingField(null)} />
                          ) : (
                            <div 
                              onDoubleClick={() => setEditingField(`curl-${idx}`)}
                              title={curl}
                              style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: '800', cursor: 'text', lineHeight: '1.5' }}>
                               CURL {idx + 1}
                            </div>
                          )}
                       </div>
                       {editingField !== `curl-${idx}` && (
                       <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => { navigator.clipboard.writeText(curl); showToast("CURL Copied!"); }} className="icon-action-btn" style={{ padding: '0px' }} title="Copy CURL"><Copy size={14} /></button>
                          <button onClick={() => setEditingField(`curl-${idx}`)} className="icon-action-btn" style={{ padding: '0px' }} title="Edit CURL"><Pencil size={14} /></button>
                          <button onClick={() => removeCurl(idx)} className="icon-action-btn" style={{ color: '#ef4444', padding: '0px' }} title="Remove CURL"><Trash size={14} /></button>
                       </div>
                       )}
                    </div>
                  ))}
                  {getCurlsArray().length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic', padding: '10px' }}>No reproduction CURLs added.</div>
                  )}
               </div>
            </div>

            <style jsx>{` .hover-editable-field:hover { background-color: color-mix(in srgb, var(--color-text-main) 6%, var(--color-bg-surface)); border-radius: 4px; outline: 1px dashed var(--color-border); } `}</style>

             {/* DISCUSSION & REVIEW SECTION */}
             <div style={{ marginTop: '48px', borderTop: '2px solid #f1f5f9', paddingTop: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                   <MessageSquare size={18} color="var(--color-primary)" />
                   <h3 style={{ fontSize: '0.9rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-main)' }}>Discussion & Review</h3>
                </div>

                {/* Comment Thread */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                   {(() => {
                      let comments = [];
                      try {
                        const raw = bug.comments;
                        if (Array.isArray(raw)) comments = raw;
                        else if (typeof raw === 'string' && raw.startsWith('[')) comments = JSON.parse(raw);
                      } catch(e) { }

                      if (comments.length === 0) return (
                        <div style={{ textAlign: 'center', padding: '32px', backgroundColor: 'var(--color-bg-body)', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                           <MessageSquare size={24} color="#94a3b8" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                           <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>No discussion started for this bug report yet.</p>
                        </div>
                      );

                      return comments.map((c, idx) => {
                        const isMe = c.author === currentReporter;
                        return (
                          <div key={c.id || idx} style={{ display: 'flex', gap: '12px', flexDirection: isMe ? 'row' : 'row-reverse', animation: 'fadeIn 0.3s ease' }}>
                             <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem', flexShrink: 0, backgroundColor: isMe ? '#2563eb' : '#8b5cf6' }}>
                                {getInitials(c.author)}
                             </div>
                             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-start' : 'flex-end' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexDirection: isMe ? 'row' : 'row-reverse' }}>
                                   <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-text-main)' }}>{isMe ? 'You' : c.author}</span>
                                   <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{formatDate(c.date)}</span>
                                </div>
                                <div style={{ 
                                   backgroundColor: isMe ? 'var(--color-bg-surface)' : 'var(--color-bg-body)',
                                   padding: '12px 14px', 
                                   borderRadius: isMe ? '0 12px 12px 12px' : '12px 0 12px 12px', 
                                   border: '1px solid var(--color-border)', 
                                   fontSize: '0.9rem', 
                                   color: 'var(--color-text-main)', 
                                   lineHeight: '1.5', 
                                   whiteSpace: 'pre-wrap',
                                   boxShadow: isMe ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
                                   maxWidth: '85%'
                                }}>
                                   {formatComment(c.text)}
                                </div>
                             </div>
                          </div>
                        );
                      });
                   })()}
                </div>

                {/* New Comment Input */}
                <div style={{ position: 'relative', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                   {showMentions && (
                     <div style={{ 
                       position: 'absolute', bottom: '100%', left: '0', mb: '8px',
                       backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '12px',
                       boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100,
                       width: '200px', maxHeight: '200px', overflowY: 'auto'
                     }}>
                        {assigneeNames.filter(a => a.toLowerCase().includes(mentionSearch.toLowerCase()) && a !== 'Not Assigned' && a !== 'Unassigned').map(user => (
                          <div key={user} onClick={() => insertMention(user)} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.6rem' }}>{getInitials(user)}</div>
                             {capitalizeName(user)}
                          </div>
                        ))}
                     </div>
                   )}
                   <textarea 
                     id="comment-textarea"
                     placeholder="Type a review comment or update here... (use @ to tag)"
                     style={{ width: '100%', border: 'none', background: 'transparent', resize: 'none', minHeight: '80px', fontSize: '0.9rem', outline: 'none', color: 'var(--color-text-main)' }}
                     value={newComment}
                     onChange={handleTextChange}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
                     }}
                   />
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>Press <b>CMD + Enter</b> to post</span>
                      <button 
                         onClick={handleAddComment}
                         disabled={!newComment.trim()}
                         style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: newComment.trim() ? '#2563eb' : 'color-mix(in srgb, var(--color-text-main) 15%, var(--color-bg-surface))', color: 'white', fontWeight: '700', fontSize: '0.8rem', border: 'none', cursor: newComment.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                         Post Review
                      </button>
                   </div>
                </div>
             </div>

          </div>

          <div className="drawer-side" style={{ width: '340px', paddingBottom: '30px' }}>
            <div className="meta-item">
              <div className="meta-label"><Clock size={14} /> Priority & Severity</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                  {editingField === 'priority' ? (
                    <CustomDropdown
                      options={settings.priorities}
                      selected={tempValues.priority !== undefined ? tempValues.priority : bug.priority}
                      onSelect={(val) => updateTempValue('priority', val)}
                      placeholder="Priority"
                      style={{ minWidth: '110px' }}
                      onClose={() => setEditingField(null)}
                    />
                  ) : (
                    <span onDoubleClick={() => startEdit('priority', bug.priority)} className={`badge ${getPriorityClass(tempValues.priority !== undefined ? tempValues.priority : bug.priority)}`} style={{ cursor: 'pointer' }}>{tempValues.priority !== undefined ? tempValues.priority : bug.priority}</span>
                  )}
                  {editingField === 'severity' ? (
                    <CustomDropdown
                      options={["Critical", "Major", "Minor"]}
                      selected={tempValues.severity !== undefined ? tempValues.severity : bug.severity}
                      onSelect={(val) => updateTempValue('severity', val)}
                      placeholder="Severity"
                      style={{ minWidth: '110px' }}
                      onClose={() => setEditingField(null)}
                    />
                  ) : (
                    <span onDoubleClick={() => startEdit('severity', bug.severity)} className="badge badge-outline" style={{ cursor: 'pointer' }}>{tempValues.severity !== undefined ? tempValues.severity : bug.severity}</span>
                  )}
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-label"><CheckSquare size={14} /> Assignee</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <div className="avatar">{getInitials(getAssigneeName(tempValues.assignee !== undefined ? tempValues.assignee : bug.assignee))}</div>
                {editingField === 'assignee' ? (
                  <CustomDropdown
                    options={assigneeNames}
                    selected={getAssigneeName(tempValues.assignee !== undefined ? tempValues.assignee : bug.assignee)}
                    onSelect={(val) => updateTempValue('assignee', getAssigneeName(val))}
                    placeholder="Assignee"
                    fullWidth
                    onClose={() => setEditingField(null)}
                  />
                ) : (
                  <span onDoubleClick={() => startEdit('assignee', bug.assignee)} style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-text-main)', cursor: 'pointer' }}>{capitalizeName(getAssigneeName(tempValues.assignee !== undefined ? tempValues.assignee : bug.assignee))}</span> 
                )}
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-label"><HardDrive size={14} /> Product Domain</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {editingField === 'project' ? ( 
                  <CustomDropdown
                    options={["Pharmacy ERP", "Clinic ERP", "Laboratory ERP", "Hospital ERP"]}
                    selected={tempValues.project !== undefined ? tempValues.project : bug.project}
                    onSelect={(val) => {
                      const newModules = getModulesForProject(val);
                      setTempValues(prev => ({ ...prev, project: val, module: newModules[0] }));
                    }}
                    placeholder="Project"
                    fullWidth
                    onClose={() => setEditingField(null)}
                  />
                ) : ( 
                  <span onDoubleClick={() => startEdit('project', bug.project)} className="badge badge-tag" style={{ cursor: 'pointer', fontSize: '0.8rem', width: 'fit-content' }}>{tempValues.project !== undefined ? tempValues.project : (bug.project || 'General')}</span> 
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ChevronRight size={12} color="#94a3b8" />
                  {editingField === 'module' ? (
                    <CustomDropdown
                      options={getModulesForProject(tempValues.project !== undefined ? tempValues.project : bug.project)}
                      selected={tempValues.module !== undefined ? tempValues.module : bug.module}
                      onSelect={(val) => updateTempValue('module', val)}
                      placeholder="Module"
                      fullWidth
                      onClose={() => setEditingField(null)}
                    />
                  ) : (
                    <span onDoubleClick={() => startEdit('module', bug.module)} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-primary)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {getFullModulePath(
                        tempValues.project !== undefined ? tempValues.project : bug.project,
                        tempValues.module !== undefined ? tempValues.module : bug.module
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="meta-item"><div className="meta-label"><Clock size={14} /> Timeline</div><div className="meta-value" style={{ fontSize: '0.85rem', marginTop: '6px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--color-text-muted)' }}>Start:</span><input type="date" style={{ border: 'none', background: 'none', fontSize: '0.8rem', textAlign: 'right', fontWeight: '600' }} value={tempValues.startDate !== undefined ? tempValues.startDate : (bug.startDate || '')} onChange={(e) => updateTempValue('startDate', e.target.value)} /></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Deadline:</span><input type="date" style={{ border: 'none', background: 'none', fontSize: '0.8rem', textAlign: 'right', color: '#ef4444', fontWeight: '700' }} value={tempValues.endDate !== undefined ? tempValues.endDate : (bug.endDate || '')} onChange={(e) => updateTempValue('endDate', e.target.value)} /></div></div></div>

             <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '20px', marginTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>Related Issue Cluster</div>
              {(() => {
                const visited = new Set();
                const queue = [bug.id];
                visited.add(bug.id);
                const getBRel = (b) => { try { return typeof b.relatedBugs === 'string' ? JSON.parse(b.relatedBugs || '[]') : (b.relatedBugs || []); } catch(e) { return []; } };
                while (queue.length > 0) {
                  const currentId = queue.shift();
                  const currentBug = allBugs.find(b => b.id === currentId);
                  if (currentBug) getBRel(currentBug).forEach(id => { if (!visited.has(id)) { visited.add(id); queue.push(id); } });
                  allBugs.forEach(b => { if (!visited.has(b.id)) if (getBRel(b).includes(currentId)) { visited.add(b.id); queue.push(b.id); } });
                }
                visited.delete(bug.id);
                const cluster = Array.from(visited).map(id => allBugs.find(b => b.id === id)).filter(Boolean);
                if (cluster.length === 0) return <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No cluster linked.</div>;
                return ( <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}> {cluster.map(related => ( <div key={related.id} onClick={() => attemptNavigate(related)} style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)' }}><Link2 size={12} color="var(--color-primary)" /> <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{getShortId(related.id)}:</span> {related.title}</div> ))} </div> );
              })()}
            </div>

            <div className="meta-item" style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '20px', marginTop: '20px' }}><div className="meta-label"><User size={14} /> Reporter</div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.5rem', backgroundColor: '#8b5cf6' }}>{getInitials(bug.reporter)}</div><span className="meta-value" style={{ fontSize: '0.8rem', fontWeight: '600' }}>{capitalizeName(getAssigneeName(bug.reporter)) || 'System'}</span></div></div>

            <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '20px', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                 <History size={16} color="var(--color-primary)" />
                 <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Record</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {(() => {
                  const history = [];
                  try {
                    const activity = typeof bug.activityLog === 'string' ? JSON.parse(bug.activityLog || '[]') : (bug.activityLog || []);
                    history.push(...activity);
                  } catch(e) {}
                  if (history.length === 0) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-light)', fontSize: '0.75rem', backgroundColor: 'var(--color-bg-body)', borderRadius: '8px' }}>No records found.</div>;
                  return history.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)).map((item, idx) => (
                    <div key={idx} style={{ position: 'relative', paddingBottom: '16px', paddingLeft: '20px', borderLeft: '1px solid var(--color-border)' }}>
                       <div style={{ position: 'absolute', left: '-5px', top: '0', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-bg-surface)', border: '1.5px solid var(--color-primary)' }}></div>
                       <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-main)' }}>{item.action || 'Updated'}</div>
                       {item.type === 'curl' && (
                         <div style={{ marginTop: '4px' }}>
                           <button 
                             onClick={() => setViewingCurl({ index: idx, value: item.details })}
                             style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: '600' }}>
                             <Eye size={12} /> View CURL Context
                           </button>
                         </div>
                       )}
                       {(item.from || item.to) && (() => {
                         const fromVal = typeof item.from === 'object' ? JSON.stringify(item.from) : (item.from || '—');
                         const toVal = typeof item.to === 'object' ? JSON.stringify(item.to) : (item.to || '—');
                         return (
                         <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div className="restore-target" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                               <span style={{ textDecoration: 'line-through', opacity: 0.7, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fromVal !== '—' ? fromVal : ''}>
                                  {fromVal}
                               </span>
                               {fromVal !== '—' && (
                                  <button onClick={() => restoreLogValue(item, 'from')} className="icon-action-btn" style={{ padding: '2px', backgroundColor: 'var(--color-bg-body)' }} title="Restore this old value">
                                     <RotateCcw size={10} color="var(--color-primary)" />
                                  </button>
                               )}
                            </div>
                            <ArrowRight size={10} style={{ flexShrink: 0 }} />
                            <div className="restore-target" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                               <span style={{ color: 'var(--color-text-main)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={toVal !== '—' ? toVal : ''}>
                                  {toVal}
                               </span>
                               {toVal !== '—' && (
                                  <button onClick={() => restoreLogValue(item, 'to')} className="icon-action-btn" style={{ padding: '2px', backgroundColor: 'var(--color-bg-body)' }} title="Restore this new value">
                                     <RotateCcw size={10} color="var(--color-primary)" />
                                  </button>
                               )}
                            </div>
                         </div>
                         );
                       })()}
                       <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', marginTop: '2px' }}>{formatDate(item.date)}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" style={{ zIndex: 12000 }} onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(440px, 92vw)', padding: 'clamp(20px, 4vw, 36px)', textAlign: 'center', borderRadius: '24px' }}>
            <div style={{ backgroundColor: '#fff7ed', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#f97316' }}> <AlertCircle size={32} /> </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px' }}>Unsaved Modifications</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>You have pending edits to <b>{getShortId(bug.id)}</b>. How would you like to proceed?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => handleSaveAll(true)} style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#2563eb', color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Save size={18} /> Save & {pendingNavigation ? 'Go to Linked' : 'Close'}</button>
              <button onClick={() => setShowConfirmModal(false)} style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Keep Editing</button>
              <button onClick={handleDiscard} style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: 'var(--color-bg-surface)', color: '#ef4444', fontWeight: '600', border: '1px solid #ef4444', cursor: 'pointer' }}>Discard & {pendingNavigation ? 'Continue' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ENHANCED CURL INSPECTION OVERLAY (PRO-SIZE - MATERIAL LIGHT ADAPTATION) */}
      {viewingCurl && (
        <div className="modal-overlay" style={{ zIndex: 13000, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setViewingCurl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
            width: '90vw', 
            maxWidth: 'min(1000px, 95vw)', 
            height: '80vh', 
            padding: '40px', 
            borderRadius: '28px', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: 'var(--color-bg-surface)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--color-border)',
            animation: 'modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>Technical Artifact Inspection</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: '500' }}>Double-click the code surface to copy this record to your clipboard. Use this for local reproduction.</p>
              </div>
              <button 
                onClick={() => setViewingCurl(null)} 
                className="icon-action-btn" 
                style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-muted)', transition: 'all 0.2s' }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div 
              onDoubleClick={() => { navigator.clipboard.writeText(viewingCurl.value); showToast("Success: Artifact Copied!"); }}
              title="Double-click to copy"
              style={{ 
                flex: 1, 
                backgroundColor: 'var(--color-bg-body)', 
                color: 'var(--color-text-main)', 
                padding: '36px', 
                borderRadius: '20px', 
                fontSize: '0.95rem', 
                fontFamily: 'var(--font-mono)', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-all', 
                overflowY: 'auto', 
                border: '1px solid var(--color-border)', 
                cursor: 'pointer', 
                lineHeight: '1.7', 
                boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.03)',
                position: 'relative'
              }}>
              <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'var(--color-bg-surface)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', color: 'var(--color-text-light)', border: '1px solid var(--color-border)', textTransform: 'uppercase' }}>
                RAW SOURCE
              </div>
              {viewingCurl.value}
            </div>

            <div style={{ marginTop: '28px', display: 'flex', gap: '16px' }}>
              <button 
                onClick={() => { navigator.clipboard.writeText(viewingCurl.value); showToast("CURL Copied!"); }}
                style={{ 
                  flex: 3, 
                  padding: '18px', 
                  borderRadius: '16px', 
                  backgroundColor: 'var(--color-primary)', 
                  color: 'white', 
                  fontWeight: '750', 
                  border: 'none', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '12px', 
                  fontSize: '1rem',
                  boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Copy size={20} /> Copy Reproduction Context
              </button>
              <button 
                onClick={() => setViewingCurl(null)}
                style={{ 
                  flex: 1, 
                  padding: '18px', 
                  borderRadius: '16px', 
                  backgroundColor: 'var(--color-bg-body)', 
                  color: 'var(--color-text-muted)', 
                  fontWeight: '700', 
                  border: '1px solid var(--color-border)', 
                  cursor: 'pointer', 
                  fontSize: '1rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              >
                Dismiss
              </button>
            </div>
          </div>
          <style jsx>{`
            @keyframes modalSlideIn {
              from { opacity: 0; transform: translateY(20px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
