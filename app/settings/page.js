"use client";
import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Activity, Signal, Folder, Settings, ShieldCheck, ChevronRight, Upload, Camera } from 'lucide-react';
import GlobalHeader from '../components/GlobalHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { capitalizeName } from '../components/AuthProvider';

const AVATAR_OPTIONS = [
  '/avatars/astronaut.png',
  '/avatars/demon.png',
  '/avatars/liberty.png',
  '/avatars/princess.png',
  '/avatars/warrior.png'
];

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];

export default function SettingsPage() {
  const [settings, setSettings] = useState({ assignees: [], statuses: [], priorities: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [newInputs, setNewInputs] = useState({ assignees: "", statuses: "", priorities: "", projects: "" });
  const [editingMemberProfile, setEditingMemberProfile] = useState(null);
  const [editingMemberName, setEditingMemberName] = useState('');
  const [customAvatars, setCustomAvatars] = useState([]);
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(res => res.ok ? res.json() : { projects: [], statuses: [], priorities: [], assignees: [] }),
      fetch('/api/avatars/custom').then(res => res.json()).catch(() => ({ avatars: [] }))
    ]).then(([data, avatarData]) => {
      setSettings(data);
      setCustomAvatars(avatarData.avatars || []);
      setLoading(false);
    });
  }, []);

  const handleAdd = async (category) => {
    const value = newInputs[category].trim();
    if (!value) return;
    
    // Check for duplicates
    const isDuplicate = (settings[category] || []).some(item => {
      const existingName = typeof item === 'object' ? item.name : item;
      return existingName === value;
    });

    if (isDuplicate) {
      showToast(`This ${category.slice(0, -1)} already exists!`);
      return;
    }

    const currentList = Array.isArray(settings[category]) ? settings[category] : [];
    let newItem = value;
    if (category === 'assignees') {
      newItem = {
        name: value,
        gender: 'male',
        avatar: AVATAR_OPTIONS[currentList.length % AVATAR_OPTIONS.length],
        color: COLORS[currentList.length % COLORS.length]
      };
    }
    const updatedSettings = {
      ...settings,
      [category]: [...currentList, newItem]
    };

    setSettings(updatedSettings);
    setNewInputs({ ...newInputs, [category]: "" });

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    } catch (e) {
      console.error("Failed to add settings item:", e);
    }
  };

  const handleDelete = async (category, index) => {
    const itemToDelete = settings[category][index];
    
    // Safety guard for system-reserved profiles
    const itemName = typeof itemToDelete === 'object' ? itemToDelete.name : itemToDelete;
    if (category === 'assignees' && (itemName === 'Unassigned' || itemName === 'Not Assigned')) {
      showToast("System reserved profiles cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${itemName}"? This change is permanent.`)) {
      return;
    }

    const updatedSettings = {
      ...settings,
      [category]: settings[category].filter((_, i) => i !== index)
    };

    setSettings(updatedSettings);

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    } catch (e) {
      console.error("Failed to delete settings item:", e);
    }
  };

  const handleUpdateMemberAvatar = async (memberName, newAvatar) => {
    const updatedAssignees = settings.assignees.map(a =>
      (typeof a === 'object' ? a.name : a) === memberName ? { ...a, avatar: newAvatar } : a
    );
    const updatedSettings = { ...settings, assignees: updatedAssignees };
    setSettings(updatedSettings);
    setEditingMemberProfile(null);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    } catch (e) {
      console.error("Failed to update avatar:", e);
    }
  };

  const handleUpdateMemberName = async (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2) { showToast('Name must be at least 2 characters.'); return; }
    if (trimmed === oldName) { setEditingMemberName(''); return; }
    if (settings.assignees.some(a => (typeof a === 'object' ? a.name : a) === trimmed)) { showToast('This name already exists!'); return; }

    const updatedAssignees = settings.assignees.map(a =>
      (typeof a === 'object' ? a.name : a) === oldName ? { ...a, name: trimmed } : a
    );
    const updatedSettings = { ...settings, assignees: updatedAssignees };
    setSettings(updatedSettings);
    setEditingMemberProfile(prev => prev ? { ...prev, name: trimmed } : null);
    setEditingMemberName('');
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    } catch (e) {
      console.error("Failed to update name:", e);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/avatars/custom', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.path) {
        setCustomAvatars(prev => [...prev, data.path]);
        if (editingMemberProfile) {
          handleUpdateMemberAvatar(editingMemberProfile.name, data.path);
        }
      } else {
        showToast(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      showToast('Failed to upload image.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const [deletingAvatar, setDeletingAvatar] = useState(null);

  const confirmDeleteAvatar = (e, avatarPath) => {
    e.stopPropagation();
    setDeletingAvatar(avatarPath);
  };

  const handleDeleteCustomAvatar = async () => {
    if (!deletingAvatar) return;
    try {
      const res = await fetch('/api/avatars/custom', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: deletingAvatar })
      });
      if (res.ok) {
        setCustomAvatars(prev => prev.filter(a => a !== deletingAvatar));
        if (editingMemberProfile && editingMemberProfile.avatar === deletingAvatar) {
          handleUpdateMemberAvatar(editingMemberProfile.name, '');
        }
      }
    } catch (err) { console.error('Delete failed:', err); }
    setDeletingAvatar(null);
  };

  if (loading) return <LoadingOverlay message="System Configuration" subtext="Linking to global data streams..." />;

  const renderSection = (category, title, Icon) => (
    <div className="card" style={{
      padding: '0',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
      border: '1px solid var(--color-border-light)',
      borderRadius: '16px'
    }}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid var(--color-border-light)',
        backgroundColor: 'var(--color-bg-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: '8px', borderRadius: '10px', color: 'var(--color-primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <Icon size={20} />
          </div>
          <h2 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-primary)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))', padding: '4px 10px', borderRadius: '99px', border: '1px solid var(--color-border)' }}>
          {settings[category]?.length || 0} items
        </span>
      </div>

      <div style={{ padding: '20px', backgroundColor: 'var(--color-bg-surface)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--color-border-light)' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            className="form-input"
            style={{ flex: 1, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', padding: '10px 14px' }}
            placeholder={`Add new ${title.toLowerCase().slice(0, -1)}...`}
            value={newInputs[category]}
            onChange={(e) => setNewInputs({ ...newInputs, [category]: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(category); }}
          />
          <button className="btn btn-primary" onClick={() => handleAdd(category)} style={{ padding: '0 16px', borderRadius: '10px', height: '42px' }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: '120px', maxHeight: '350px' }}>
        {settings[category]?.map((item, index) => {
          const itemName = typeof item === 'object' ? item.name : item;
          const isReserved = category === 'assignees' && (itemName === 'Unassigned' || itemName === 'Not Assigned');
          const isAssigneeObj = category === 'assignees' && typeof item === 'object';

          return (
            <div key={index} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 24px', borderBottom: '1px solid var(--color-border-light)',
              opacity: isReserved ? 0.7 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isAssigneeObj ? (
                  <div
                    onClick={() => { if (!isReserved) { setEditingMemberProfile(item); setEditingMemberName(''); } }}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      overflow: 'hidden',
                      border: `2px solid ${item.color || '#e2e8f0'}`,
                      cursor: isReserved ? 'default' : 'pointer',
                      position: 'relative', flexShrink: 0,
                      backgroundColor: item.color || '#2563eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: '0.65rem', fontWeight: '800'
                    }}
                    title={isReserved ? '' : 'Click to change avatar'}
                  >
                    {item.avatar ? (
                      <img
                        src={item.avatar}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : null}
                    {(item.name || '').substring(0, 2).toUpperCase()}
                    {!isReserved && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.4)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.2s'
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                      >
                        <Camera size={12} color="white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <ChevronRight size={10} color="#cbd5e1" />
                )}
                <span style={{ fontSize: '0.9rem', color: isReserved ? 'var(--color-text-light)' : 'var(--color-text-main)', fontWeight: '600' }}>
                    {capitalizeName(itemName)} {isReserved && <span style={{fontSize: '0.65rem', fontWeight: '800', backgroundColor: 'var(--color-bg-body)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px'}}>SYSTEM</span>}
                </span>
              </div>
              {!isReserved && (
                <button className="icon-action-btn" onClick={() => handleDelete(category, index)} style={{ color: '#f43f5e', padding: '6px' }} title="Delete">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
        {settings[category]?.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Plus size={24} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>No items defined.</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '80px', paddingLeft: 'clamp(12px, 2vw, 20px)', paddingRight: 'clamp(12px, 2vw, 20px)' }}>
      <div style={{ paddingTop: '20px', marginBottom: '24px' }}>
        <GlobalHeader 
          placeholder="Search settings..." 
        />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '10px', color: 'white' }}>
            <Settings size={19} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '600', color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>Drop Tracker Settings</h1>
          </div>
        </div>
        <p style={{ opacity: 0.6, fontSize: '1rem', marginLeft: '52px', fontWeight: '500' }}>Micro-configure your team lifecycle and status mapping.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: '24px'
      }}>
        {renderSection('statuses', 'Active Statuses', Activity)}
        {renderSection('priorities', 'Priority Levels', Signal)}
        {renderSection('projects', 'Project Domains', Folder)}
      </div>

      <div style={{ marginTop: '48px', padding: '24px', backgroundColor: 'var(--color-bg-body)', borderRadius: '16px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <ShieldCheck size={28} color="#22c55e" />
        <div>
          <h4 style={{ fontWeight: '800', color: 'var(--color-text-main)', fontSize: '0.9rem' }}>System Integrity Enforced</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>All changes made here will reflect globally across all active bug reports and filters immediately.</p>
        </div>
      </div>

      {/* AVATAR PICKER MODAL */}
      {editingMemberProfile && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-surface)', padding: '2.5rem', borderRadius: '28px',
            width: 'min(700px, 95vw)', maxWidth: '95vw', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                overflow: 'hidden', position: 'relative',
                backgroundColor: editingMemberProfile.color || '#2563eb',
                border: `3px solid ${editingMemberProfile.color || '#2563eb'}`,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '1.2rem', fontWeight: '800'
              }}>
                {editingMemberProfile.avatar && (
                  <img
                    src={editingMemberProfile.avatar}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                {(editingMemberProfile.name || '').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: '500', marginBottom: '4px' }}>Edit profile settings</p>
                {editingMemberName ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      autoFocus
                      type="text"
                      value={editingMemberName}
                      onChange={(e) => setEditingMemberName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateMemberName(editingMemberProfile.name, editingMemberName); if (e.key === 'Escape') setEditingMemberName(''); }}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '2px solid #2563eb', fontSize: '1rem', fontWeight: '700', outline: 'none' }}
                    />
                    <button onClick={() => handleUpdateMemberName(editingMemberProfile.name, editingMemberName)} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingMemberName('')} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)', cursor: 'pointer', color: 'var(--color-text-muted)' }}>Cancel</button>
                  </div>
                ) : (
                  <div onClick={() => setEditingMemberName(editingMemberProfile.name)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text-main)' }}>{capitalizeName(editingMemberProfile.name)}</h2>
                    <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--color-text-light)', padding: '2px 8px', backgroundColor: 'var(--color-bg-body)', borderRadius: '6px' }}>Edit</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
              {/* Upload Section */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Upload Custom Image</h3>
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  padding: '20px', borderRadius: '16px', border: '2px dashed var(--color-border)',
                  cursor: 'pointer', backgroundColor: 'var(--color-bg-body)',
                  transition: 'all 0.2s', color: 'var(--color-text-muted)', fontWeight: '700', fontSize: '0.85rem'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                >
                  <Upload size={18} />
                  {uploadingAvatar ? 'Uploading...' : 'Click to upload image (PNG, JPG, WebP - max 5MB)'}
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={uploadingAvatar} />
                </label>
              </div>

              {/* Remove Avatar Option */}
              {editingMemberProfile.avatar && (
                <div style={{ marginBottom: '2rem' }}>
                  <button
                    onClick={() => handleUpdateMemberAvatar(editingMemberProfile.name, '')}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '14px',
                      border: '2px solid #fecaca', backgroundColor: '#fef2f2',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '10px',
                      color: '#dc2626', fontWeight: '700', fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Trash2 size={16} />
                    Remove Profile Image
                  </button>
                </div>
              )}

              {/* Preset Avatars */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Characters</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(70px, 100%), 1fr))', gap: '12px' }}>
                  {AVATAR_OPTIONS.map((avatarPath, i) => (
                    <div
                      key={i}
                      onClick={() => handleUpdateMemberAvatar(editingMemberProfile.name, avatarPath)}
                      style={{
                        aspectRatio: '1', borderRadius: '16px', backgroundColor: 'var(--color-bg-body)',
                        backgroundImage: `url(${avatarPath})`, backgroundSize: 'cover', backgroundPosition: 'center',
                        cursor: 'pointer',
                        border: editingMemberProfile.avatar === avatarPath ? '3px solid #2563eb' : '3px solid transparent',
                        boxShadow: editingMemberProfile.avatar === avatarPath ? '0 8px 20px rgba(37,99,235,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                        transform: editingMemberProfile.avatar === avatarPath ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Uploaded Avatars */}
              {customAvatars.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Custom Uploads</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(70px, 100%), 1fr))', gap: '12px' }}>
                    {customAvatars.map((avatarPath, i) => (
                      <div
                        key={i}
                        onClick={() => handleUpdateMemberAvatar(editingMemberProfile.name, avatarPath)}
                        style={{
                          aspectRatio: '1', borderRadius: '16px', backgroundColor: 'var(--color-bg-body)',
                          backgroundImage: `url(${avatarPath})`, backgroundSize: 'cover', backgroundPosition: 'center',
                          cursor: 'pointer', position: 'relative', overflow: 'hidden',
                          border: editingMemberProfile.avatar === avatarPath ? '3px solid #2563eb' : '3px solid transparent',
                          boxShadow: editingMemberProfile.avatar === avatarPath ? '0 8px 20px rgba(37,99,235,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                          transform: editingMemberProfile.avatar === avatarPath ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <button
                          onClick={(e) => confirmDeleteAvatar(e, avatarPath)}
                          style={{
                            position: 'absolute', top: '4px', right: '4px', zIndex: 5,
                            width: '24px', height: '24px', borderRadius: '50%',
                            backgroundColor: 'rgba(239,68,68,0.9)', border: '2px solid white',
                            color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', padding: 0
                          }}
                          title="Delete this image"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setEditingMemberProfile(null)}
              style={{
                marginTop: '1.5rem', padding: '12px 28px', borderRadius: '12px',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)',
                fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* DELETE AVATAR CONFIRM MODAL */}
      {deletingAvatar && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 20000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)'
        }}
          onClick={() => setDeletingAvatar(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'var(--color-bg-surface)', borderRadius: '24px', padding: '32px',
            width: 'min(400px, 92vw)', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '16px', margin: '0 auto 20px',
              backgroundImage: `url(${deletingAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center',
              border: '3px solid #fecaca', boxShadow: '0 4px 12px rgba(239,68,68,0.2)'
            }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '8px' }}>Delete Image?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '28px', lineHeight: '1.5' }}>
              This will permanently remove the uploaded image. Any profile using it will lose their avatar.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeletingAvatar(null)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '14px',
                  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)',
                  fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCustomAvatar}
                style={{
                  flex: 1, padding: '14px', borderRadius: '14px',
                  border: 'none', backgroundColor: '#ef4444', color: 'white',
                  fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1e293b', color: 'white', padding: '12px 24px',
          borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600',
          zIndex: 50000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.3s ease-out'
        }}>{toast}</div>
      )}

      <style jsx>{`
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
