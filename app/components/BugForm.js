"use client";
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Pencil, Check, ExternalLink, Copy, AlertCircle, Bug as BugIcon } from 'lucide-react';
import CustomDropdown from './CustomDropdown';

const getAssigneeName = (a) => {
  if (typeof a === 'object' && a !== null) return a.name || '';
  if (typeof a === 'string' && a.startsWith('{')) { try { return JSON.parse(a).name || a; } catch { return a; } }
  return a || '';
};

export default function BugForm({ isOpen, onClose, onSave, settings, initialData = null, showToast, currentReporter, bugs = [], saving = false }) {
  const assigneeNames = (settings?.assignees || []).map(a => getAssigneeName(a));

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedResult: "",
    actualResult: "",
    priority: settings?.priorities?.[0] || "Low",
    severity: "Minor",
    project: "Pharmacy ERP",
    assignee: getAssigneeName(settings?.assignees?.[0]) || "Unassigned",
    reporter: currentReporter || "rohith",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: settings?.statuses?.[0] || "Open",
    module: "General",
    curl: [],
    githubPr: [],
    relatedBugs: [],
    comments: []
  });

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


  const [isAddingCurl, setIsAddingCurl] = useState(false);
  const [editingCurl, setEditingCurl] = useState(null); // { index: number, value: string }
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [initialFormString, setInitialFormString] = useState("");

  useEffect(() => {
    if (!initialData && currentReporter) {
      setFormData(prev => ({ ...prev, reporter: currentReporter }));
    }
  }, [currentReporter, initialData]);

  useEffect(() => {
    if (initialData) {
      let curlArray = [];
      let relatedBugsArray = [];
      let githubPrArray = [];
      try {
        if (typeof initialData.curl === 'string' && initialData.curl.startsWith('[')) {
          curlArray = JSON.parse(initialData.curl);
        } else if (initialData.curl) {
          curlArray = Array.isArray(initialData.curl) ? initialData.curl : [initialData.curl]; 
        }

        if (typeof initialData.relatedBugs === 'string' && initialData.relatedBugs.startsWith('[')) {
          relatedBugsArray = JSON.parse(initialData.relatedBugs);
        } else if (initialData.relatedBugs) {
          relatedBugsArray = Array.isArray(initialData.relatedBugs) ? initialData.relatedBugs : [initialData.relatedBugs];
        }

        if (typeof initialData.githubPr === 'string' && initialData.githubPr.startsWith('[')) {
          githubPrArray = JSON.parse(initialData.githubPr);
        } else if (initialData.githubPr) {
          githubPrArray = Array.isArray(initialData.githubPr) ? initialData.githubPr : [initialData.githubPr]; 
        }
      } catch (e) {
        curlArray = initialData.curl ? [initialData.curl] : [];
        relatedBugsArray = initialData.relatedBugs ? [initialData.relatedBugs] : [];
        githubPrArray = initialData.githubPr ? [initialData.githubPr] : [];
      }

      let commentsArray = [];
      try {
        if (typeof initialData.comments === 'string' && initialData.comments.startsWith('[')) {
          commentsArray = JSON.parse(initialData.comments);
        } else if (Array.isArray(initialData.comments)) {
          commentsArray = initialData.comments;
        }
      } catch (e) { commentsArray = []; }

      const updatedData = {
        ...formData,
        ...initialData,
        curl: curlArray,
        relatedBugs: relatedBugsArray,
        githubPr: githubPrArray,
        comments: commentsArray
      };
      setFormData(updatedData);
      setInitialFormString(JSON.stringify(updatedData));
      if (curlArray.length > 0) setIsAddingCurl(true);
    } else {
      const newFormData = {
        title: "",
        description: "",
        stepsToReproduce: "",
        expectedResult: "",
        actualResult: "",
        priority: settings?.priorities?.[0] || "Low",
        severity: "Minor",
        project: "Pharmacy ERP",
        assignee: getAssigneeName(settings?.assignees?.[0]) || "Unassigned",
        reporter: currentReporter || "rohith",
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        status: settings?.statuses?.[0] || "Open",
        module: "General",
        curl: [],
        githubPr: [],
        relatedBugs: [],
        comments: []
      };
      setFormData(newFormData);
      setInitialFormString(JSON.stringify(newFormData));
      setIsAddingCurl(false);
    }
    setShowDiscardConfirm(false); 
  }, [initialData, settings, isOpen, currentReporter]);


  const isDirty = () => {
    return JSON.stringify(formData) !== initialFormString;
  };

  const handleSafeClose = () => {
    if (isDirty()) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const validateForm = () => {
    const isTitleEmpty = !formData.title.trim();
    const isDescEmpty = !formData.description.trim();
    const isAssigneeEmpty = !formData.assignee || 
      (typeof formData.assignee === 'object' ? formData.assignee.name : formData.assignee) === 'Not Assigned';

    if (isTitleEmpty && isDescEmpty) {
      showToast("Title and Description are required!");
      return false;
    }
    if (isTitleEmpty) {
      showToast("Title is required!");
      return false;
    }
    if (isDescEmpty) {
      showToast("Description is required!");
      return false;
    }
    if (isAssigneeEmpty) {
      showToast("Please assign this bug to a team member!");
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const isNew = !initialData;
    const finalData = {
      ...formData,
      reporter: isNew ? currentReporter : formData.reporter,
      curl: formData.curl, 
      relatedBugs: formData.relatedBugs,
      githubPr: formData.githubPr,
      comments: formData.comments,
      createdAt: isNew ? new Date().toISOString() : formData.createdAt
    };

    if (!isNew) {
      finalData.id = formData.id;
    }
    onSave(finalData, isNew);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSave();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleSafeClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: 'min(720px, 95vw)',
        padding: '0',
        borderRadius: 14
      }}>

        <div style={{
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: '#f43f5e18', color: '#f43f5e',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <BugIcon size={17} />
            </div>
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {initialData ? 'Update Bug Report' : 'Create New Bug Report'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {initialData ? 'Modify the existing bug details.' : 'Report a new bug with details for tracking.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-muted)', cursor: 'pointer'
            }}
            onClick={handleSafeClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'hidden'
          }}
        >
          {/* Scrollable Content Area */}
          <div style={{ padding: '0 24px 20px 24px', overflowY: 'auto', flex: 1, paddingBottom: '30px' }}>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.86rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none', fontFamily: 'var(--font-family)' }}
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the bug"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Description <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                required
                rows="2"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.86rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none', fontFamily: 'var(--font-family)', resize: 'vertical' }}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Steps to Reproduce
              </label>
              <textarea
                rows="3"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.86rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none', fontFamily: 'var(--font-family)', resize: 'vertical' }}
                value={formData.stepsToReproduce}
                onChange={e => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Expected Result</label>
                <textarea
                  rows="2"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.86rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none', fontFamily: 'var(--font-family)' }}
                  value={formData.expectedResult}
                  onChange={e => setFormData({ ...formData, expectedResult: e.target.value })}
                  placeholder="What should happen"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#b91c1c', marginBottom: '6px', textTransform: 'uppercase' }}>Actual Result</label>
                <textarea
                  rows="2"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.86rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none', fontFamily: 'var(--font-family)' }}
                  value={formData.actualResult}
                  onChange={e => setFormData({ ...formData, actualResult: e.target.value })}
                  placeholder="What actually happened"
                />
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
              gap: '12px', 
              marginBottom: '16px' 
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</label>
                <CustomDropdown 
                  options={settings.priorities}
                  selected={formData.priority}
                  onSelect={(val) => setFormData({ ...formData, priority: val })}
                  placeholder="Priority"
                  fullWidth
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity</label>
                <CustomDropdown 
                  options={["Critical", "Major", "Minor"]}
                  selected={formData.severity}
                  onSelect={(val) => setFormData({ ...formData, severity: val })}
                  placeholder="Severity"
                  fullWidth
                />
              </div>
              {initialData && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                  <CustomDropdown 
                    options={settings.statuses}
                    selected={formData.status}
                    onSelect={(val) => setFormData({ ...formData, status: val })}
                    placeholder="Status"
                    fullWidth
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Domain</label>
                <CustomDropdown 
                  options={["Pharmacy ERP", "Clinic ERP", "Laboratory ERP", "Hospital ERP"]}
                  selected={formData.project}
                  onSelect={(val) => {
                    const newModules = getModulesForProject(val);
                    setFormData({ 
                      ...formData, 
                      project: val, 
                      module: newModules.includes(formData.module) ? formData.module : newModules[0] 
                    });
                  }}
                  placeholder="Project"
                  fullWidth
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Functional Module</label>
                <CustomDropdown 
                  options={getModulesForProject(formData.project)}
                  selected={formData.module}
                  onSelect={(val) => setFormData({ ...formData, module: val })}
                  placeholder="Select Module"
                  fullWidth
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px', marginBottom: '24px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign to <span style={{ color: '#ef4444' }}>*</span></label>
                    <CustomDropdown
                      options={assigneeNames}
                      selected={getAssigneeName(formData.assignee)}
                      onSelect={(val) => setFormData({ ...formData, assignee: getAssigneeName(val) })}
                      placeholder="Select developer"
                      fullWidth
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
                    <input
                      type="date"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
                      value={formData.startDate}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
                    <input
                      type="date"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
                      value={formData.endDate}
                      onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    />
                </div>
            </div>

            {/* Bug Connections Section */}
            <div style={{ 
              backgroundColor: 'var(--color-bg-body)', 
              padding: '24px', 
              borderRadius: '16px', 
              border: '1px solid var(--color-border)', 
              marginBottom: '32px' 
            }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '16px', letterSpacing: '0.05em' }}>
                Technical Linkage & Cluster
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GitHub PR Artifacts</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {formData.githubPr.map((pr, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
                          placeholder="Merge request link..."
                          value={pr}
                          onChange={e => {
                            const newPrs = [...formData.githubPr];
                            newPrs[idx] = e.target.value;
                            setFormData({ ...formData, githubPr: newPrs });
                          }}
                        />
                        <button type="button" onClick={() => setFormData({ ...formData, githubPr: formData.githubPr.filter((_, i) => i !== idx) })} style={{ padding: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setFormData({ ...formData, githubPr: [...formData.githubPr, ""] })} style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Plus size={14} /> Add PR Link</button>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CURL Context (Reproduction)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {formData.curl.map((snippet, idx) => (
                      <div key={idx} style={{ padding: '10px', backgroundColor: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)' }}>CURL {idx + 1}</code>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" onClick={() => setEditingCurl({ index: idx, value: snippet })} style={{ padding: '4px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}><Pencil size={14} /></button>
                          <button type="button" onClick={() => setFormData({ ...formData, curl: formData.curl.filter((_, i) => i !== idx) })} style={{ padding: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditingCurl({ index: formData.curl.length, value: "" })} style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Plus size={14} /> Add CURL Script</button>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Related Issue Cluster</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {formData.relatedBugs.length > 0 ? (
                    formData.relatedBugs.map(rid => {
                      const relatedBug = bugs.find(b => b.id === rid);
                      return (
                        <div key={rid} className="badge badge-status-pro" style={{ padding: '6px 12px', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', gap: '8px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{relatedBug ? (String(relatedBug.id).startsWith("BUG-") ? relatedBug.id : `BUG-${String(relatedBug.id).split('-')[0].substring(0,4).toUpperCase()}`) : rid}</span>
                          <X size={14} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => setFormData({ ...formData, relatedBugs: formData.relatedBugs.filter(i => i !== rid) })} />
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>No sister bugs currently linked.</span>
                  )}
                </div>
                <CustomDropdown 
                  options={bugs
                    .filter(b => b.id !== formData.id && !formData.relatedBugs.includes(b.id))
                    .map(b => `${String(b.id).startsWith("BUG-") ? b.id : `BUG-${String(b.id).split('-')[0].substring(0,4).toUpperCase()}`} - ${b.title}`)
                  }
                  onSelect={(val) => {
                    const bugId = val.split(' - ')[0];
                    const selectedBug = bugs.find(b => {
                      const short = String(b.id).startsWith("BUG-") ? b.id : `BUG-${String(b.id).split('-')[0].substring(0,4).toUpperCase()}`;
                      return short === bugId;
                    });
                    if (selectedBug && !formData.relatedBugs.includes(selectedBug.id)) {
                      setFormData({ ...formData, relatedBugs: [...formData.relatedBugs, selectedBug.id] });
                    }
                  }}
                  placeholder="+ Associate related bug reports..."
                  fullWidth
                />
              </div>
            </div>
          </div>
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14
          }}>
            <button
              type="button"
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer'
              }}
              onClick={handleSafeClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: 'none', backgroundColor: '#0f172a',
                color: 'white',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer'
              }}
            >
              {initialData ? 'Update the Bug' : 'Create Bug report'}
            </button>
          </div>
        </form>
      </div>

      {/* CURL EDITOR MODAL (MATERIAL LIGHT ADAPTATION) */}
      {editingCurl !== null && (
        <div className="modal-overlay" style={{ zIndex: 11000, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setEditingCurl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '900px', 
            width: '95%', 
            padding: '40px',
            borderRadius: '28px',
            backgroundColor: 'var(--chrome-bg-raised)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text-main)' }}>
                  {formData.curl[editingCurl.index] ? 'Edit Technical Sequence' : 'Add Technical Sequence'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Input your CURL command or technical reproduction script below.</p>
              </div>
              <button 
                onClick={() => setEditingCurl(null)} 
                style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              autoFocus
              style={{
                width: '100%',
                minHeight: '400px',
                padding: '24px',
                borderRadius: '20px',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                backgroundColor: 'var(--color-bg-body)',
                color: 'var(--color-text-main)',
                lineHeight: '1.7',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)',
                resize: 'none'
              }}
              placeholder="Paste your CURL command or CLI reproduction snippet here..."
              value={editingCurl.value}
              onChange={(e) => setEditingCurl({ ...editingCurl, value: e.target.value })}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '32px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setEditingCurl(null)}
                style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: '700' }}
              >
                Discard
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '12px 32px', borderRadius: '12px', fontWeight: '700', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
                onClick={() => {
                  const newList = [...formData.curl];
                  if (editingCurl.index < newList.length) {
                    newList[editingCurl.index] = editingCurl.value;
                  } else {
                    newList.push(editingCurl.value);
                  }
                  setFormData({ ...formData, curl: newList.filter(c => c.trim() !== '') });
                  setEditingCurl(null);
                }}
              >
                Apply Sequence
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

      {/* DISCARD CONFIRMATION MODAL */}
      {showDiscardConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%', padding: '24px', textAlign: 'center' }}>
            <div style={{ color: 'var(--color-primary)', marginBottom: '16px' }}>
              <AlertCircle size={52} style={{ margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px' }}>Unsaved Changes</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '28px', lineHeight: '1.5' }}>
              You have made modifications to this bug report. Would you like to save your progress before closing?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontWeight: '700' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
              >
                {saving ? 'Saving...' : 'Save and Close'}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ backgroundColor: '#fee2e2', borderColor: '#fecaca', color: '#b91c1c', padding: '10px', fontSize: '0.85rem' }}
                  onClick={onClose}
                >
                  Discard All
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '10px', fontSize: '0.85rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDiscardConfirm(false);
                  }}
                >
                  Keep Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
