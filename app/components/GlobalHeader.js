"use client";
import { useState, useEffect } from 'react';
import { Search, Bell, MailOpen, ExternalLink, BarChart3, Settings, Folder, Bug, ChevronRight, Box } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';

export default function GlobalHeader({
  placeholder = "Search bugs, projects, team..."
}) {
  const { currentReporter, notifications, unreadCount, fetchNotifications, getInitials, globalSearchQuery, setGlobalSearchQuery, globalBugs, globalSettings } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setGlobalSearchQuery(val);
    setShowResults(val.trim().length > 0);
  };

  // Close overlays on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.notification-area') && showNotifications) {
        setShowNotifications(false);
      }
      if (!e.target.closest('.search-column') && showResults) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications, showResults]);

  const handleNotificationClick = async (n) => {
    setShowNotifications(false);
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) });
    fetchNotifications();
    router.push(`/bugs?bug=${n.bugId}`);
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allForUser: currentReporter }) });
    fetchNotifications();
  };

  // --- Universal Search Logic ---
  const navigations = [
    { label: "Bugs Dashboard", path: "/bugs", icon: Bug, keywords: ["bugs", "dashboard", "home", "tickets", "list"] },
    { label: "Product Insights & Analytics", path: "/analytics", icon: BarChart3, keywords: ["analytics", "insights", "charts", "timeline", "trends"] },
    { label: "Project Portfolios", path: "/projects", icon: Folder, keywords: ["projects", "portfolios", "health", "overview"] },
    { label: "Drop Tracker Settings", path: "/settings", icon: Settings, keywords: ["settings", "config", "members", "assignees", "status", "priority", "admin"] }
  ];

  const widgets = [
    { label: "Priority Timeline", path: "/analytics", keywords: ["timeline", "priority", "trend", "graph", "analytics widget"] },
    { label: "Project Distribution", path: "/analytics", keywords: ["distribution", "donut", "chart", "project spread", "analytics widget"] },
    { label: "Resolution Rate", path: "/analytics", keywords: ["resolution", "rate", "success", "resolved proportion", "analytics widget"] },
    { label: "Your Desk", path: "/", keywords: ["desk", "my tasks", "assigned to me", "todo", "dashboard widget"] },
    { label: "Mission Control", path: "/", keywords: ["mission control", "overview", "landing", "dashboard widget"] }
  ];

  const q = globalSearchQuery.toLowerCase().trim();

  const filteredNavs = navigations.filter(n =>
    n.label.toLowerCase().includes(q) || n.keywords.some(k => k.includes(q))
  );

  const filteredWidgets = widgets.filter(w =>
    w.label.toLowerCase().includes(q) || w.keywords.some(k => k.includes(q))
  );

  const filteredProjects = (globalSettings.projects || []).filter(p =>
    p.toLowerCase().includes(q)
  );

  const filteredBugs = (globalBugs || [])
    .filter(b =>
      String(b.title || '').toLowerCase().includes(q) ||
      String(b.id || '').toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const aId = String(a.id || '').toLowerCase();
      const bId = String(b.id || '').toLowerCase();
      const aTitle = String(a.title || '').toLowerCase();
      const bTitle = String(b.title || '').toLowerCase();

      // Scoring logic:
      // Exact ID or BUG-ID match: 4
      // ID starts with BUG-Q: 3
      // ID includes Q: 2
      // Title includes Q: 1
      const getScore = (id, title) => {
        if (id === q || id === `bug-${q}`) return 4;
        if (id.startsWith(`bug-${q}`)) return 3;
        if (id.includes(q)) return 2;
        if (title.includes(q)) return 1;
        return 0;
      };

      return getScore(bId, bTitle) - getScore(aId, aTitle);
    })
    .slice(0, 5);

  const hasResults = filteredNavs.length > 0 || filteredWidgets.length > 0 || filteredProjects.length > 0 || filteredBugs.length > 0;

  const navigateTo = (path) => {
    setShowResults(false);
    router.push(path);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '24px' }}>
      <div className="search-column" style={{ flex: 1, position: 'relative' }}>
        <div className="search-container" style={{ height: '44px', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: showResults ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={globalSearchQuery}
            onChange={handleSearchChange}
            onFocus={() => globalSearchQuery.trim().length > 0 && setShowResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pathname !== '/bugs') {
                navigateTo('/bugs');
              }
            }}
          />
        </div>

        {/* --- UNIVERSAL SEARCH DROPDOWN --- */}
        {showResults && (
          <div style={{
            position: 'absolute', top: '52px', left: 0, right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: '18px',
            boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 1000, overflow: 'hidden', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.8)', padding: '8px'
          }}>
            {!hasResults ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                <Search size={24} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>No matches found for "{globalSearchQuery}"</p>
                <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Try searching bugs, sections, or projects.</p>
              </div>
            ) : (
              <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                {/* Sections */}
                {filteredNavs.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: '850', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>App Sections</div>
                    {filteredNavs.map(nav => (
                      <div key={nav.path} onClick={() => navigateTo(nav.path)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-shadow">
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          <nav.icon size={16} />
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>{nav.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Widgets */}
                {filteredWidgets.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: '850', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>System Widgets</div>
                    {filteredWidgets.map(widget => (
                      <div key={widget.label} onClick={() => navigateTo(widget.path)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer' }} className="hover-shadow">
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                          <Box size={16} />
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>{widget.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Projects */}
                {filteredProjects.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: '850', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>Available Projects</div>
                    {filteredProjects.map(proj => (
                      <div key={proj} onClick={() => navigateTo(`/bugs?project=${encodeURIComponent(proj)}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer' }} className="hover-shadow">
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                          <Folder size={16} />
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>{proj}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bugs */}
                {filteredBugs.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: '850', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>Bug Reports</div>
                    {filteredBugs.map(bug => (
                      <div key={bug.id} onClick={() => navigateTo(`/bugs?bug=${bug.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer' }} className="hover-shadow">
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                          <Bug size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bug.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{bug.id} • {bug.project}</div>
                        </div>
                        <ChevronRight size={14} color="#cbd5e1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', marginTop: '4px', backgroundColor: '#f8fafc', margin: '0 -8px -8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Press <span style={{ fontWeight: '800', backgroundColor: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>Enter</span> for advanced bug search</span>
            </div>
          </div>
        )}
      </div>

      <div className="notification-area" style={{ position: 'relative' }}>
        <button className="icon-action-btn" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowNotifications(!showNotifications)}>
          <Bell size={20} color={unreadCount > 0 ? 'var(--color-primary)' : '#64748b'} />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: '900', padding: '2px 6px', borderRadius: '99px', border: '2px solid white', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)' }}>{unreadCount}</span>
          )}
        </button>
        {showNotifications && (
          <div style={{ position: 'absolute', top: '55px', right: '0', width: '380px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)', zIndex: 100, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notifications</span>
              {unreadCount > 0 && (<button onClick={handleMarkAllRead} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '700', border: 'none', background: 'none', cursor: 'pointer' }}>Mark all as read</button>)}
            </div>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <MailOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>Inbox is crystal clear!</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ padding: '16px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: n.isRead ? 'transparent' : 'rgba(37, 99, 235, 0.03)', display: 'flex', gap: '14px' }}>
                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem', flexShrink: 0, marginTop: '2px', backgroundColor: '#8b5cf6' }}>{getInitials(n.actor)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>{n.actor} tagged you</span>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>"{n.message}"</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '700' }}><ExternalLink size={10} /> Bug {n.bugId.substring(0, 8)}...</div>
                    </div>
                    {!n.isRead && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', marginTop: '4px' }}></div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
