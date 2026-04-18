"use client";
import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Camera } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { capitalizeName, useAuth } from '../components/AuthProvider';
import { CollapsibleList } from '../components/CollapsibleSection';

const AVATAR_OPTIONS = [
  '/avatars/astronaut.png',
  '/avatars/demon.png',
  '/avatars/liberty.png',
  '/avatars/princess.png',
  '/avatars/warrior.png'
];

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];

export default function SettingsPage() {
  const { globalSettings } = useAuth();
  const [settings, setSettings] = useState(() => globalSettings || { assignees: [], statuses: [], priorities: [], projects: [] });
  const [loading, setLoading] = useState(!globalSettings);
  const [newInputs, setNewInputs] = useState({ assignees: "", statuses: "", priorities: "", projects: "" });
  const [editingMemberProfile, setEditingMemberProfile] = useState(null);
  const [editingMemberName, setEditingMemberName] = useState('');
  const [customAvatars, setCustomAvatars] = useState([]);
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  useEffect(() => {
    if (globalSettings) { setSettings(globalSettings); setLoading(false); }
  }, [globalSettings]);

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

  const handleDelete = (category, index) => {
    const itemToDelete = settings[category][index];
    const itemName = typeof itemToDelete === 'object' ? itemToDelete.name : itemToDelete;
    if (category === 'assignees' && (itemName === 'Unassigned' || itemName === 'Not Assigned')) {
      showToast("System reserved profiles cannot be deleted.");
      return;
    }
    setDeletingItem({ category, index, name: itemName });
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    const { category, index } = deletingItem;
    const updatedSettings = {
      ...settings,
      [category]: settings[category].filter((_, i) => i !== index)
    };
    setSettings(updatedSettings);
    setDeletingItem(null);
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

  const renderSection = (category, title) => (
    <section style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>{title}</div>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600,
          color: 'var(--color-text-muted)',
          backgroundColor: 'var(--chrome-bg-subtle)',
          padding: '1px 9px', borderRadius: 999
        }}>{settings[category]?.length || 0}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={{
            flex: 1, height: 38, padding: '0 14px',
            borderRadius: 10, border: '1px solid var(--chrome-border)',
            backgroundColor: 'var(--chrome-bg-raised)',
            fontSize: '0.86rem', color: 'var(--color-text-main)',
            fontFamily: 'var(--font-family)', outline: 'none'
          }}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}…`}
          value={newInputs[category]}
          onChange={(e) => setNewInputs({ ...newInputs, [category]: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(category); }}
        />
        <button
          onClick={() => handleAdd(category)}
          style={{
            height: 38, padding: '0 14px', borderRadius: 10, border: 'none',
            backgroundColor: '#111827', color: 'white',
            fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6
          }}>
          <Plus size={14} /> Add
        </button>
      </div>

      <CollapsibleList
        items={settings[category] || []}
        emptyMessage="None yet."
        alwaysExpanded
        renderItem={(item) => {
          const index = (settings[category] || []).indexOf(item);
          const itemName = typeof item === 'object' ? item.name : item;
          const isReserved = category === 'assignees' && (itemName === 'Unassigned' || itemName === 'Not Assigned');
          const isAssigneeObj = category === 'assignees' && typeof item === 'object';
          return (
            <div key={itemName + index} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '10px 8px',
              borderBottom: '1px solid var(--chrome-border)',
              opacity: isReserved ? 0.6 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {isAssigneeObj && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <div
                    onClick={() => { if (!isReserved) { setEditingMemberProfile(item); setEditingMemberName(''); } }}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      overflow: 'hidden', flexShrink: 0,
                      backgroundColor: item.color || '#2563eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: '0.6rem', fontWeight: 600,
                      position: 'relative',
                      cursor: isReserved ? 'default' : 'pointer'
                    }}>
                    {item.avatar && <img src={item.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />}
                    {(item.name || '').substring(0, 2).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '0.88rem', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {capitalizeName(itemName)}
                  {isReserved && <span style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 8 }}>system</span>}
                </span>
              </div>
              {!isReserved && (
                <button
                  onClick={() => handleDelete(category, index)}
                  title="Delete"
                  style={{ border: 'none', background: 'none', color: 'var(--color-text-light)', padding: 4, cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        }}
      />
    </section>
  );

  return (
    <div style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Settings"
        subtitle="Configure statuses, priorities, and project domains for your workspace."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: 40
      }}>
        {renderSection('statuses',   'Status')}
        {renderSection('priorities', 'Priorities')}
        {renderSection('projects',   'Projects')}
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

      {/* DELETE SETTINGS ITEM CONFIRM MODAL */}
      {deletingItem && (
        <div className="modal-overlay" style={{ zIndex: 20000 }} onClick={() => setDeletingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '8px' }}>
              Delete {deletingItem.category.slice(0, -1).replace(/^./, c => c.toUpperCase())}?
            </h3>
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '4px', textTransform: 'uppercase' }}>
                {deletingItem.category}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text-main)', wordBreak: 'break-word' }}>
                {capitalizeName(deletingItem.name)}
              </div>
            </div>
            <p style={{ marginBottom: '28px', color: 'var(--color-text-muted)' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeletingItem(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1, backgroundColor: '#ef4444', color: 'white' }} onClick={confirmDelete} autoFocus>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#ffffff', color: '#0f172a', padding: '12px 24px',
          borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600',
          zIndex: 50000, boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          border: '1px solid var(--color-border)',
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
