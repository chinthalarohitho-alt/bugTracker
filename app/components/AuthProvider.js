"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { Plus, UserPlus, X, Check, Trash2 } from 'lucide-react';
import LoadingOverlay from './LoadingOverlay';

const AuthContext = createContext();

export function AuthProvider({ children, settings }) {
  const [currentReporter, setCurrentReporter] = useState(null);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalBugs, setGlobalBugs] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({ projects: [], statuses: [], priorities: [], assignees: [] });
  
  // New States for Profile Creation
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchGlobalData = async () => {
    try {
      const [bugsRes, settingsRes] = await Promise.all([
        fetch('/api/bugs', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' })
      ]);
      const bugsData = await bugsRes.json();
      const settingsData = await settingsRes.json();
      setGlobalBugs(Array.isArray(bugsData) ? bugsData : (bugsData.bugs || []));
      setGlobalSettings(settingsData);
    } catch (e) {
      console.error("Error fetching global data:", e);
    }
  };

  const fetchNotifications = async () => {
    if (!currentReporter) return;
    try {
      const res = await fetch(`/api/notifications?user=${encodeURIComponent(currentReporter)}`);
      const data = await res.json();
      const list = data.notifications || [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.isRead).length);
    } catch(e) {
      console.error("Error fetching notifications:", e);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchGlobalData();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchGlobalData();
    }, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [currentReporter]);

  useEffect(() => {
    const savedReporter = localStorage.getItem('bugTracker_reporter');
    if (savedReporter) {
      setCurrentReporter(savedReporter);
      setShowUserSelection(false);
    } else {
      setShowUserSelection(true);
    }
    setLoading(false);
  }, []);

  const handleUserSelect = (name) => {
    setCurrentReporter(name);
    setShowUserSelection(false);
    localStorage.setItem('bugTracker_reporter', name);
  };

  const handleSwitchUser = () => {
    setShowUserSelection(true);
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().substring(0, 2).toUpperCase();
  };

  const handleAddProfile = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (globalSettings.assignees.includes(trimmed)) {
      alert("This profile name already exists!");
      return;
    }

    setIsCreating(true);
    const updatedAssignees = [...(globalSettings.assignees || []), trimmed];
    const updatedSettings = { ...globalSettings, assignees: updatedAssignees };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setGlobalSettings(updatedSettings);
        handleUserSelect(trimmed);
        setIsAdding(false);
        setNewName("");
      }
    } catch (error) {
      console.error("Failed to add profile:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProfile = async (e, name) => {
    e.stopPropagation(); // Don't trigger user selection

    if (name === 'Unassigned' || name === 'Not Assigned') {
      alert("System reserved profiles cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete profile "${name}"?`)) {
      return;
    }

    const updatedAssignees = globalSettings.assignees.filter(a => a !== name);
    const updatedSettings = { ...globalSettings, assignees: updatedAssignees };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setGlobalSettings(updatedSettings);
        // If we deleted the current user, we should stay on selection screen
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

  const value = {
    currentReporter,
    handleUserSelect,
    handleSwitchUser,
    getInitials,
    showUserSelection,
    notifications,
    unreadCount,
    fetchNotifications,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalBugs,
    globalSettings
  };

  if (loading) {
    return <LoadingOverlay fullPage={true} message="Initializing System" subtext="Securing terminal and authenticating modules..." />;
  }

  if (showUserSelection) {
    const profiles = globalSettings.assignees.length > 0 ? globalSettings.assignees : (settings.assignees || []);
    const filteredProfiles = profiles.filter(a => a !== 'Not Assigned' && a !== 'Unassigned');

    return (
      <AuthContext.Provider value={value}>
        <div className="modal-overlay" style={{
          zIndex: 5000,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100vw',
          position: 'fixed',
          top: 0,
          left: 0,
          animation: 'fadeIn 0.6s ease-out',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <h1 style={{
            fontSize: '2.75rem',
            fontWeight: '850',
            color: '#0f172a',
            marginBottom: '4.5rem',
            textAlign: 'center',
            letterSpacing: '-0.04em'
          }}>
            {isAdding ? 'Create New Profile' : 'Choose User Profile'}
          </h1>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2.5rem',
            flexWrap: 'wrap',
            padding: '0 40px',
            animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            maxWidth: '1200px'
          }}>
            {!isAdding ? (
              <>
                {filteredProfiles.map((name, idx) => {
                  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];
                  const color = colors[idx % colors.length];

                  return (
                    <button
                      key={name}
                      onClick={() => handleUserSelect(name)}
                      className="cinematic-profile-card profile-group"
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        width: '120px',
                        position: 'relative'
                      }}
                    >
                      {/* Delete Icon */}
                      <div 
                        onClick={(e) => handleDeleteProfile(e, name)}
                        className="profile-delete-btn"
                        style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '0px',
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f43f5e',
                            zIndex: 10,
                            opacity: 0,
                            transition: 'all 0.2s',
                            border: '1px solid #fee2e2'
                        }}
                      >
                        <Trash2 size={14} />
                      </div>

                      <div
                        className="profile-shuttle"
                        style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '4px solid white',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: color,
                          color: 'white',
                          fontSize: '2.25rem',
                          fontWeight: '900',
                          letterSpacing: '-0.02em',
                          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        {getInitials(name)}
                      </div>
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#64748b', textAlign: 'center', letterSpacing: '-0.02em' }}>
                        {name}
                      </span>
                    </button>
                  );
                })}

                {/* Add Profile Trigger */}
                <button
                  onClick={() => setIsAdding(true)}
                  className="cinematic-profile-card add-btn"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: '120px'
                  }}
                >
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    border: '4px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    marginBottom: '1rem',
                    transition: 'all 0.3s ease'
                  }}>
                    <Plus size={40} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#94a3b8', textAlign: 'center', letterSpacing: '-0.02em' }}>
                    Add Profile
                  </span>
                </button>
              </>
            ) : (
              // Add Profile Form
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '40px',
                borderRadius: '32px',
                width: '400px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                border: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <UserPlus size={40} />
                  </div>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Enter full name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: '2px solid #e2e8f0',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      backgroundColor: 'white'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddProfile();
                      if (e.key === 'Escape') setIsAdding(false);
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    disabled={isCreating}
                    onClick={() => {
                        setIsAdding(false);
                        setNewName("");
                    }}
                    style={{
                      flex: 1,
                      padding: '16px',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: 'white',
                      fontWeight: '700',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <X size={18} /> Cancel
                  </button>
                  <button
                    disabled={isCreating || !newName.trim()}
                    onClick={handleAddProfile}
                    style={{
                      flex: 2,
                      padding: '16px',
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      fontWeight: '800',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: (!newName.trim() || isCreating) ? 0.6 : 1
                    }}
                  >
                    {isCreating ? 'Creating...' : <><Check size={18} /> Create Profile</>}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <style jsx>{`
            .profile-group:hover .profile-delete-btn {
                opacity: 1 !important;
                transform: translateY(-5px);
            }
            .profile-delete-btn:hover {
                background-color: #f43f5e !important;
                color: white !important;
                box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4) !important;
            }
          `}</style>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
