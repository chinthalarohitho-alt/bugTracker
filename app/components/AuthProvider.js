"use client";
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Plus, UserPlus, X, Check, Trash2, Upload } from 'lucide-react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import LoadingOverlay from './LoadingOverlay';

const capitalizeName = (name) => {
  if (!name || typeof name !== 'string') return name || '';
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const AuthContext = createContext();

export function AuthProvider({ children, settings }) {
  const { data: sessionData, status: sessionStatus } = useSession();
  const [currentReporter, setCurrentReporter] = useState(null);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalBugs, setGlobalBugs] = useState([]);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [customAvatars, setCustomAvatars] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [userRole, setUserRole] = useState('Team Member');

  const ROLE_OPTIONS = [
    'Founder',
    'HR Admin',
    'Sales Manager',
    'Developer',
    'QA Engineer',
    'Product Manager',
    'Project Manager',
    'Designer',
    'DevOps',
    'Tech Lead',
    'Engineering Manager'
  ];

  const getRoleForProfile = (name) => {
    if (!name || typeof window === 'undefined') return 'Team Member';
    return localStorage.getItem(`bugTracker_role_${name}`) || 'Team Member';
  };

  const setRoleForProfile = (name, role) => {
    if (!name || typeof window === 'undefined') return;
    localStorage.setItem(`bugTracker_role_${name}`, role);
    if (name === currentReporter) setUserRole(role);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const PRESET_AVATARS = {
    Characters: [
      '/avatars/astronaut.png',
      '/avatars/demon.png',
      '/avatars/liberty.png',
      '/avatars/princess.png',
      '/avatars/warrior.png'
    ]
  };

  const AVATAR_GALLERY = [
    ...PRESET_AVATARS.Characters
  ];

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];

  // New States for Profile Creation
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchGlobalData = async () => {
    try {
      const results = await Promise.allSettled([
        fetch('/api/bugs', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/avatars/custom', { cache: 'no-store' })
      ]);

      const [bugsOutcome, settingsOutcome, customAvatarsOutcome] = results;

      let bugsData = { bugs: [] };
      if (bugsOutcome.status === 'fulfilled' && bugsOutcome.value.ok) {
        bugsData = await bugsOutcome.value.json();
      }

      let settingsData = { projects: [], statuses: [], priorities: [], assignees: [] };
      if (settingsOutcome.status === 'fulfilled' && settingsOutcome.value.ok) {
        settingsData = await settingsOutcome.value.json();
      }

      if (customAvatarsOutcome.status === 'fulfilled' && customAvatarsOutcome.value.ok) {
        const customAvatarsData = await customAvatarsOutcome.value.json();
        setCustomAvatars(customAvatarsData.avatars || []);
      }

      // Perform Migration if needed
      if (Array.isArray(settingsData.assignees) && settingsData.assignees.length > 0 && typeof settingsData.assignees[0] === 'string') {
        const migrated = settingsData.assignees.map((name, i) => {
          const gender = name.toLowerCase().includes('hassini') ? 'female' : 'male';
          const avatar = AVATAR_GALLERY[i % AVATAR_GALLERY.length];
          return {
            name,
            gender,
            avatar,
            color: COLORS[i % COLORS.length]
          };
        });
        const migratedData = { ...settingsData, assignees: migrated };
        setGlobalSettings(migratedData);
        // Persist migration
        fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(migratedData) });
      } else {
        // Capitalize all assignee names and reorder: move yagna next to kowshik
        if (Array.isArray(settingsData.assignees)) {
          let assignees = settingsData.assignees.map(a => {
            if (typeof a === 'object' && a.name) return { ...a, name: capitalizeName(a.name) };
            return a;
          });

          const kowshikIdx = assignees.findIndex(a => (a.name || '').toLowerCase() === 'kowshik');
          const yagnaIdx = assignees.findIndex(a => (a.name || '').toLowerCase() === 'yagna');
          if (kowshikIdx !== -1 && yagnaIdx !== -1 && Math.abs(kowshikIdx - yagnaIdx) > 1) {
            const [yagna] = assignees.splice(yagnaIdx, 1);
            const newKowshikIdx = assignees.findIndex(a => (a.name || '').toLowerCase() === 'kowshik');
            assignees.splice(newKowshikIdx + 1, 0, yagna);
          }

          const needsUpdate = JSON.stringify(assignees) !== JSON.stringify(settingsData.assignees);
          settingsData = { ...settingsData, assignees };
          if (needsUpdate) {
            fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsData) });
          }
        }
        setGlobalSettings(settingsData);
      }

      setGlobalBugs(Array.isArray(bugsData) ? bugsData : (bugsData.bugs || []));
    } catch (e) {
      console.error("Error fetching global data:", e);
    }
  };

  const fetchNotifications = async () => {
    if (!currentReporter) return;
    try {
      const res = await fetch(`/api/notifications?user=${encodeURIComponent(currentReporter)}`);
      if (!res.ok) { setNotifications([]); setUnreadCount(0); return; }
      const data = await res.json();
      const list = data.notifications || [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.isRead).length);
    } catch (e) {
      console.error("Error fetching notifications:", e);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const pollFailCount = useRef(0);

  useEffect(() => {
    fetchNotifications();
    fetchGlobalData();

    let timer;
    const poll = () => {
      Promise.allSettled([fetchNotifications(), fetchGlobalData()]).then(results => {
        const anyFailed = results.some(r => r.status === 'rejected');
        if (anyFailed) {
          pollFailCount.current = Math.min(pollFailCount.current + 1, 5);
        } else {
          pollFailCount.current = 0;
        }
        const delay = 30000 * Math.pow(1.5, pollFailCount.current); // 30s base, backoff on failures
        timer = setTimeout(poll, delay);
      });
    };
    timer = setTimeout(poll, 30000);
    return () => clearTimeout(timer);
  }, [currentReporter]);

  useEffect(() => {
    if (!currentReporter) return;
    setUserRole(getRoleForProfile(currentReporter));
  }, [currentReporter]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'authenticated' && sessionData?.user) {
      const email = (sessionData.user.email || '').toLowerCase().trim();

      // If already onboarded (saved in localStorage), skip DB check
      const savedReporter = localStorage.getItem('bugTracker_reporter');
      const savedEmail = localStorage.getItem('bugTracker_email');
      if (savedReporter && savedEmail === email) {
        setCurrentReporter(savedReporter);
        setShowUserSelection(false);
        setLoading(false);
        // Fetch settings in background
        fetch('/api/settings').then(r => r.ok ? r.json() : null).then(s => {
          if (s) setGlobalSettings(s);
        }).catch(() => {});
        return;
      }

      // Check if user exists by email in DB
      fetch('/api/settings').then(r => r.ok ? r.json() : null).then(s => {
        if (!s) { setLoading(false); return; }
        setGlobalSettings(s);
        const assignees = s.assignees || [];
        const existing = assignees.find(a => {
          const aEmail = (typeof a === 'object' ? (a.email || '') : '').toLowerCase().trim();
          return aEmail && aEmail === email;
        });

        if (existing) {
          const name = typeof existing === 'object' ? existing.name : existing;
          setCurrentReporter(name);
          setShowUserSelection(false);
          localStorage.setItem('bugTracker_reporter', name);
          localStorage.setItem('bugTracker_email', email);
        } else {
          setOnboardingEmail(email);
          setShowOnboarding(true);
          setShowUserSelection(false);
        }
        setLoading(false);
      }).catch(() => { setLoading(false); });
      return;
    }

    // Unauthenticated: middleware should have redirected to /signin,
    // but fall back to localStorage for any non-gated screens.
    const savedReporter = localStorage.getItem('bugTracker_reporter');
    if (savedReporter) {
      setCurrentReporter(savedReporter);
      setShowUserSelection(false);
    }
    setLoading(false);
  }, [sessionStatus, sessionData]);

  const completeOnboarding = async (name, role, avatarUrl) => {
    const s = globalSettings || {};
    const newMember = { name, email: onboardingEmail, avatar: avatarUrl || sessionData?.user?.image || '', color: '#2563eb', role: role || 'Team Member' };
    const updated = { ...s, assignees: [...(s.assignees || []), newMember] };
    try {
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      setGlobalSettings(updated);
      if (role) setRoleForProfile(name, role);
      setCurrentReporter(name);
      setShowOnboarding(false);
      localStorage.setItem('bugTracker_reporter', name);
      localStorage.setItem('bugTracker_email', onboardingEmail);
    } catch {}
  };

  const handleUserSelect = (profile) => {
    const name = typeof profile === 'string' ? profile : profile.name;
    setCurrentReporter(name);
    setShowUserSelection(false);
    localStorage.setItem('bugTracker_reporter', name);
  };

  const handleSwitchUser = () => {
    setIsManageMode(false);
    localStorage.removeItem('bugTracker_reporter');
    nextAuthSignOut({ callbackUrl: '/signin' });
  };

  const getAvatar = (name) => {
    const profile = (globalSettings?.assignees || []).find(p => p.name === name);
    if (profile) return profile.avatar || '';
    return '';
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().substring(0, 2).toUpperCase();
  };

  const [newGender, setNewGender] = useState('male');

  const handleAddProfile = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (globalSettings.assignees.some(p => p.name === trimmed)) {
      showToast("This profile name already exists!");
      return;
    }

    setIsCreating(true);
    const allAvatars = AVATAR_GALLERY;
    const defaultAvatar = allAvatars[Math.floor(Math.random() * allAvatars.length)];

    const newProfile = {
      name: trimmed,
      gender: newGender,
      avatar: defaultAvatar,
      color: COLORS[globalSettings.assignees.length % COLORS.length]
    };

    const updatedAssignees = [...(globalSettings.assignees || []), newProfile];
    const updatedSettings = { ...globalSettings, assignees: updatedAssignees };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setGlobalSettings(updatedSettings);
        handleUserSelect(newProfile);
        setIsAdding(false);
        setNewName("");
      }
    } catch (error) {
      console.error("Failed to add profile:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProfile = async (e, profile) => {
    e.stopPropagation();
    const name = profile.name;

    if (name === 'Unassigned' || name === 'Not Assigned') {
      showToast("System reserved profiles cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete profile "${name}"?`)) {
      return;
    }

    const updatedAssignees = globalSettings.assignees.filter(a => a.name !== name);
    const updatedSettings = { ...globalSettings, assignees: updatedAssignees };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setGlobalSettings(updatedSettings);
        if (currentReporter === name) {
          setCurrentReporter(null);
          localStorage.removeItem('bugTracker_reporter');
          setShowUserSelection(true);
        }
      }
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  const handleUpdateAvatar = async (profile, newAvatar) => {
    const updatedAssignees = globalSettings.assignees.map(a =>
      a.name === profile.name ? { ...a, avatar: newAvatar } : a
    );
    const updatedSettings = { ...globalSettings, assignees: updatedAssignees };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setGlobalSettings(updatedSettings);
        setEditingProfile(null);
      }
    } catch (e) { console.error(e); }
  };

  const [editingName, setEditingName] = useState('');

  const handleUpdateName = async (profile, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2) { showToast('Name must be at least 2 characters.'); return; }
    if (trimmed === profile.name) { setEditingName(''); return; }
    if (globalSettings.assignees.some(a => a.name === trimmed)) { showToast('This name already exists!'); return; }

    const oldName = profile.name;
    const updatedAssignees = globalSettings.assignees.map(a =>
      a.name === oldName ? { ...a, name: trimmed } : a
    );
    const updatedSettings = { ...globalSettings, assignees: updatedAssignees };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setGlobalSettings(updatedSettings);
        setEditingProfile({ ...editingProfile, name: trimmed });
        setEditingName('');
        if (currentReporter === oldName) {
          setCurrentReporter(trimmed);
          localStorage.setItem('bugTracker_reporter', trimmed);
        }
      }
    } catch (e) { console.error(e); }
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.'); return; }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/avatars/custom', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.path) {
        setCustomAvatars(prev => [...prev, data.path]);
        if (editingProfile) {
          handleUpdateAvatar(editingProfile, data.path);
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
        if (editingProfile && editingProfile.avatar === deletingAvatar) {
          handleUpdateAvatar(editingProfile, '');
        }
      }
    } catch (err) { console.error('Delete failed:', err); }
    setDeletingAvatar(null);
  };

  const value = {
    currentReporter,
    handleUserSelect,
    handleSwitchUser,
    getInitials,
    getAvatar,
    showUserSelection,
    notifications,
    unreadCount,
    fetchNotifications,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalBugs,
    globalSettings,
    setGlobalSettings,
    isManageMode,
    setIsManageMode,
    userRole,
    ROLE_OPTIONS,
    getRoleForProfile,
    setRoleForProfile,
    showOnboarding,
    completeOnboarding
  };

  if (loading) {
    return <LoadingOverlay fullPage={true} message="Initializing System" subtext="Securing terminal and authenticating modules..." />;
  }

  if (showUserSelection) {
    const profiles = globalSettings.assignees.length > 0 ? globalSettings.assignees : (settings?.assignees || []);
    const filteredProfiles = profiles.filter(p => (p.name || p) !== 'Not Assigned' && (p.name || p) !== 'Unassigned');

    return (
      <AuthContext.Provider value={value}>
        <div className="modal-overlay" style={{
          zIndex: 5000,
          backgroundColor: 'var(--color-bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          width: '100vw',
          position: 'fixed',
          top: 0,
          left: 0,
          animation: 'fadeIn 0.6s ease-out',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: 'hidden'
        }}>
          {/* Top Bar */}
          <div style={{ position: 'absolute', top: '30px', right: '40px', zIndex: 6000 }}>
            {!isAdding && !editingProfile && (
              <button
                onClick={() => setIsManageMode(!isManageMode)}
                style={{
                  padding: '8px 24px',
                  borderRadius: '6px',
                  border: isManageMode ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: isManageMode ? '#eff6ff' : 'white',
                  color: isManageMode ? '#2563eb' : '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {isManageMode ? 'Done' : 'Manage Profiles'}
              </button>
            )}
          </div>

          <div style={{
            marginTop: '10vh',
            textAlign: 'center',
            opacity: isAdding || editingProfile ? 0.3 : 1,
            transition: 'opacity 0.3s'
          }}>
            <h1 style={{
              fontSize: 'clamp(1.5rem, 6vw, 3.5rem)',
              fontWeight: '850',
              color: '#0f172a',
              marginBottom: 'clamp(1rem, 4vw, 4rem)',
              letterSpacing: '-0.05em'
            }}>
              Who Are You?
            </h1>
          </div>

          <div
            className="netflix-columns"
            style={{
              display: 'flex',
              width: '100vw',
              height: '100vh',
              opacity: isAdding || editingProfile ? 0.2 : 1,
              transition: 'all 0.4s ease'
            }}
          >
            {filteredProfiles.map((profile, idx) => (
              <div
                key={profile.name || idx}
                onClick={() => {
                  if (isManageMode) { setEditingProfile(profile); setEditingName(''); }
                  else handleUserSelect(profile);
                }}
                className={`profile-column ${isManageMode ? 'is-manage' : ''}`}
                style={{
                  '--profile-color': profile.color,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'flex 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  height: '100%'
                }}
              >
                <div className="column-bg" style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(to bottom, #f8fafc 0%, ${profile.color}22 50%, #f1f5f9 100%)`,
                  opacity: 0.8,
                  transition: 'all 0.6s ease'
                }}></div>

                <div className="avatar-wrapper" style={{
                  position: 'relative',
                  width: 'min(280px, 100%)',
                  aspectRatio: '1',
                  zIndex: 2,
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: 'grayscale(100%) brightness(0.6)',
                  transform: 'scale(0.85)'
                }}>
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        objectFit: 'cover',
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    backgroundColor: profile.color || '#2563eb',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                    display: profile.avatar ? 'none' : 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 'clamp(2rem, 5vw, 4rem)',
                    fontWeight: '900', letterSpacing: '-0.05em',
                    position: profile.avatar ? 'absolute' : 'relative',
                    top: 0, left: 0
                  }}>
                    {getInitials(profile.name)}
                  </div>

                  {isManageMode && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid white' }}>
                        <Plus size={24} />
                      </div>
                    </div>
                  )}
                </div>

                <span className="profile-name" style={{
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: '#0f172a',
                  position: 'absolute',
                  bottom: '10%',
                  zIndex: 2,
                  opacity: 0,
                  transform: 'translateY(30px)',
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                  {capitalizeName(profile.name)}
                </span>

                {isManageMode && profile.name !== currentReporter && (
                  <button
                    onClick={(e) => handleDeleteProfile(e, profile)}
                    className="column-delete"
                    style={{
                      position: 'absolute',
                      bottom: '5%',
                      color: '#ef4444',
                      background: 'none',
                      border: 'none',
                      fontWeight: '800',
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      opacity: 0,
                      transform: 'translateY(10px)',
                      transition: 'all 0.3s'
                    }}
                  >
                    Delete Profile
                  </button>
                )}
              </div>
            ))}

            {/* Add Column */}
            {!isManageMode && filteredProfiles.length < 50 && (
              <div
                onClick={() => setIsAdding(true)}
                className="profile-column add-column"
                style={{
                  flex: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderLeft: '1px solid var(--color-border-light)',
                  transition: 'all 0.4s'
                }}
              >
                <div style={{
                  padding: '20px',
                  borderRadius: '50%',
                  border: '2px dashed var(--color-border)',
                  color: 'var(--color-text-light)'
                }}>
                  <Plus size={32} />
                </div>
              </div>
            )}
          </div>

          {/* ADD PROFILE MODAL (WHITE THEME) */}
          {isAdding && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--color-bg-surface)', backdropFilter: 'blur(8px)'
            }}>
              <div style={{
                width: 'min(450px, 92vw)', backgroundColor: 'var(--color-bg-surface)', padding: 'clamp(24px, 5vw, 48px)',
                borderRadius: '32px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)',
                border: '1px solid var(--color-border-light)'
              }}>
                <h2 style={{ fontSize: '2rem', fontWeight: '850', marginBottom: '2rem', color: 'var(--color-text-main)' }}>Join the team</h2>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '8px' }}>Display Name</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Rohith Kumar"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      width: '100%', padding: '16px 20px', borderRadius: '14px',
                      border: '2px solid var(--color-border)', fontSize: '1.1rem', fontWeight: '700'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '8px' }}>Identify As</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['male', 'female'].map(g => (
                      <button
                        key={g}
                        onClick={() => setNewGender(g)}
                        style={{
                          flex: 1, padding: '14px', borderRadius: '12px',
                          border: newGender === g ? '2px solid #2563eb' : '2px solid #e2e8f0',
                          backgroundColor: newGender === g ? '#eff6ff' : 'white',
                          color: newGender === g ? '#2563eb' : '#64748b',
                          fontWeight: '800', textTransform: 'capitalize', cursor: 'pointer'
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setIsAdding(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid var(--color-border)', fontWeight: '700', cursor: 'pointer' }}>Discard</button>
                  <button
                    onClick={handleAddProfile}
                    disabled={isCreating || !newName.trim()}
                    style={{
                      flex: 1.5, padding: '16px', borderRadius: '14px', border: 'none',
                      backgroundColor: '#2563eb', color: 'white', fontWeight: '800', cursor: 'pointer',
                      opacity: !newName.trim() ? 0.6 : 1
                    }}
                  >
                    {isCreating ? 'Processing...' : 'Create Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EDIT AVATAR MODAL */}
          {editingProfile && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--color-bg-surface)', backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                backgroundColor: 'var(--color-bg-surface)', padding: '3rem', borderRadius: '40px',
                width: 'min(850px, 95vw)', maxWidth: '95vw', textAlign: 'center',
                maxHeight: '85vh', display: 'flex', flexDirection: 'column'
              }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '850', marginBottom: '1.5rem' }}>Edit Profile</h2>

                {/* Editable Name */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                  <h3 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-text-light)', marginBottom: '0.8rem', paddingLeft: '4px' }}>Display Name</h3>
                  {editingName !== null && editingName !== undefined && editingName !== '' ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        autoFocus
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateName(editingProfile, editingName); if (e.key === 'Escape') setEditingName(''); }}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: '14px', border: '2px solid #2563eb', fontSize: '1.1rem', fontWeight: '700', outline: 'none' }}
                      />
                      <button onClick={() => handleUpdateName(editingProfile, editingName)} style={{ padding: '12px 20px', borderRadius: '14px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: '800', cursor: 'pointer' }}>
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingName('')} style={{ padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)', cursor: 'pointer' }}>
                        <X size={18} color="#64748b" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingName(editingProfile.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '14px', border: '2px solid var(--color-border)', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <span style={{ flex: 1, fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text-main)' }}>{capitalizeName(editingProfile.name)}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-light)' }}>Click to edit</span>
                    </div>
                  )}
                </div>

                {/* Role Selector */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                  <h3 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-text-light)', marginBottom: '0.8rem', paddingLeft: '4px' }}>Role</h3>
                  <select
                    value={getRoleForProfile(editingProfile.name)}
                    onChange={(e) => setRoleForProfile(editingProfile.name, e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '14px',
                      border: '2px solid var(--color-border)', fontSize: '1rem', fontWeight: '700',
                      backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-main)',
                      outline: 'none', cursor: 'pointer'
                    }}
                  >
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }} className="custom-scrollbar">
                  {/* Upload Section */}
                  <div style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{
                      fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase',
                      letterSpacing: '0.15em', color: 'var(--color-text-light)', textAlign: 'left',
                      marginBottom: '1.2rem', paddingLeft: '4px'
                    }}>Upload Custom Image</h3>
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      padding: '24px', borderRadius: '20px', border: '2px dashed var(--color-border)',
                      cursor: 'pointer', backgroundColor: 'var(--color-bg-body)',
                      transition: 'all 0.2s', color: 'var(--color-text-muted)', fontWeight: '700', fontSize: '0.9rem'
                    }}>
                      <Upload size={20} />
                      {uploadingAvatar ? 'Uploading...' : 'Click to upload your profile image'}
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={uploadingAvatar} />
                    </label>
                  </div>

                  {/* Remove Avatar Option */}
                  {editingProfile.avatar && (
                    <div style={{ marginBottom: '2.5rem' }}>
                      <button
                        onClick={() => handleUpdateAvatar(editingProfile, '')}
                        style={{
                          width: '100%', padding: '16px', borderRadius: '16px',
                          border: '2px solid #fecaca', backgroundColor: '#fef2f2',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: '10px',
                          color: '#dc2626', fontWeight: '700', fontSize: '0.85rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <X size={18} />
                        Remove Profile Image
                      </button>
                    </div>
                  )}

                  {Object.entries({
                    ...PRESET_AVATARS,
                    ...(customAvatars.length > 0 ? { "Custom Uploads": customAvatars } : {})
                  }).map(([category, avatars]) => {
                    const isCustom = category === 'Custom Uploads';
                    return (
                    <div key={category} style={{ marginBottom: '2.5rem' }}>
                      <h3 style={{
                        fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase',
                        letterSpacing: '0.15em', color: 'var(--color-text-light)', textAlign: 'left',
                        marginBottom: '1.2rem', paddingLeft: '4px'
                      }}>
                        {category}
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(80px, 100%), 1fr))', gap: '14px' }}>
                        {avatars.map((avatarPath, index) => {
                          const nameMatch = avatarPath.match(/\/(?:avatars|custom)\/(.*)\.(png|jpg|jpeg|svg|webp|gif)/);
                          const displayName = nameMatch ? nameMatch[1].replace(/_/g, ' ') : 'Character';

                          return (
                            <div
                              key={index}
                              onClick={() => handleUpdateAvatar(editingProfile, avatarPath)}
                              className="avatar-option"
                              title={displayName}
                              style={{
                                aspectRatio: '1',
                                borderRadius: '20px',
                                backgroundColor: 'var(--color-bg-body)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                cursor: 'pointer',
                                border: editingProfile.avatar === avatarPath ? '4px solid #3b82f6' : '3px solid transparent',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxShadow: editingProfile.avatar === avatarPath ? '0 12px 24px rgba(59, 130, 246, 0.4)' : 'none',
                                transform: editingProfile.avatar === avatarPath ? 'scale(1.05)' : 'scale(1)',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                            >
                              <img
                                src={avatarPath}
                                style={{ width: '100%', height: '100%', display: 'block', borderRadius: '16px', position: 'relative', zIndex: 2 }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentNode.style.background = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
                                }}
                              />
                              {isCustom && (
                                <button
                                  onClick={(e) => confirmDeleteAvatar(e, avatarPath)}
                                  style={{
                                    position: 'absolute', top: '6px', right: '6px', zIndex: 5,
                                    width: '26px', height: '26px', borderRadius: '50%',
                                    backgroundColor: 'rgba(239,68,68,0.9)', border: '2px solid white',
                                    color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                    transition: 'transform 0.15s',
                                    padding: 0
                                  }}
                                  title="Delete this image"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setEditingProfile(null)}
                  style={{ marginTop: '40px', padding: '12px 32px', borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '800', cursor: 'pointer' }}
                >
                  Cancel Selection
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
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                animation: 'fadeIn 0.2s ease-out'
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

          <style jsx>{`
            .netflix-columns:hover .profile-column:not(:hover) {
               opacity: 0.3 !important;
               filter: blur(2px) grayscale(50%);
            }
            .netflix-columns:hover .profile-column:not(:hover) .column-bg {
               opacity: 0.1 !important;
               background: #f1f5f9 !important;
            }
            .profile-column:hover {
              flex: 2.2 !important;
              z-index: 10;
            }
            .profile-column:hover .column-bg {
              background: #eff6ff !important;
              opacity: 1 !important;
              box-shadow: inset 0 0 100px rgba(37, 99, 235, 0.05);
            }
            .profile-column:hover .avatar-wrapper {
              transform: scale(1.18) translateY(-8%) !important;
              filter: grayscale(0%) brightness(1) drop-shadow(0 25px 50px rgba(37,99,235,0.15)) !important;
            }
            .profile-column:hover .profile-name {
              opacity: 1 !important;
              transform: translateY(0) !important;
              color: #2563eb !important;
              letter-spacing: -0.02em;
            }
            .profile-column:hover .column-delete {
              opacity: 1 !important;
              transform: translateY(0) !important;
            }
            .shimmer {
              animation: pulse 2s infinite ease-in-out;
            }
            @keyframes pulse {
              0% { opacity: 0.3; transform: scale(0.95); }
              50% { opacity: 0.6; transform: scale(1.05); }
              100% { opacity: 0.3; transform: scale(0.95); }
            }
            .profile-column.is-manage .avatar-wrapper {
              transform: scale(0.9);
            }
            .avatar-option:hover {
              transform: scale(1.05);
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
          {toastMessage && (
            <div style={{
              position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: '#1e293b', color: 'white', padding: '12px 24px',
              borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600',
              zIndex: 50000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              animation: 'fadeIn 0.3s ease-out'
            }}>{toastMessage}</div>
          )}
        </div>
      </AuthContext.Provider>
    );
  }

  const toastEl = toastMessage ? (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#1e293b', color: 'white', padding: '12px 24px',
      borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600',
      zIndex: 50000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      animation: 'fadeIn 0.3s ease-out'
    }}>{toastMessage}</div>
  ) : null;

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toastEl}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { capitalizeName };
