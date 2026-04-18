"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search, Bell, Sun, Moon, LogOut, ChevronRight,
  Bug, Users, Folder
} from 'lucide-react';
import { useAuth, capitalizeName } from './AuthProvider';
import { useBugDrawer } from './BugDrawerProvider';

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { openBug } = useBugDrawer();
  const {
    currentReporter, userRole, getInitials, getAvatar, handleSwitchUser,
    notifications, unreadCount, fetchNotifications,
    globalSearchQuery, setGlobalSearchQuery, globalBugs, globalSettings
  } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('bugTracker_theme') === 'dark';
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('bugTracker_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.topbar-search-column') && showResults) setShowResults(false);
      if (!e.target.closest('.topbar-notif') && showNotifications) setShowNotifications(false);
      if (!e.target.closest('.topbar-user-menu') && showMenu) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showResults, showNotifications, showMenu]);

  const q = (globalSearchQuery || '').toLowerCase().trim();

  const filteredBugs = useMemo(() => {
    if (!q) return [];
    return (globalBugs || [])
      .filter(b =>
        String(b.title || '').toLowerCase().includes(q) ||
        String(b.id || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [q, globalBugs]);

  const filteredProjects = useMemo(() => {
    if (!q) return [];
    return (globalSettings?.projects || []).filter(p => String(p).toLowerCase().includes(q)).slice(0, 5);
  }, [q, globalSettings]);

  const filteredMembers = useMemo(() => {
    if (!q) return [];
    return (globalSettings?.assignees || [])
      .filter(a => {
        const name = (typeof a === 'object' ? a.name : a || '').toLowerCase();
        return name.includes(q) && name !== 'not assigned' && name !== 'unassigned';
      })
      .slice(0, 5);
  }, [q, globalSettings]);

  const hasResults = filteredBugs.length || filteredProjects.length || filteredMembers.length;

  const flatResults = useMemo(() => {
    const out = [];
    filteredBugs.forEach(b => out.push({ key: `bug:${b.id}`, bug: b }));
    filteredProjects.forEach(p => out.push({ key: `project:${p}`, path: `/bugs?project=${encodeURIComponent(p)}` }));
    filteredMembers.forEach(m => {
      const name = typeof m === 'object' ? m.name : m;
      out.push({ key: `member:${name}`, path: '/team' });
    });
    return out;
  }, [filteredBugs, filteredProjects, filteredMembers]);

  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef({});

  useEffect(() => { setActiveIndex(0); }, [globalSearchQuery]);

  useEffect(() => {
    const el = resultRefs.current[activeIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, showResults]);

  const handleSearchChange = (e) => {
    setGlobalSearchQuery(e.target.value);
    setShowResults(e.target.value.trim().length > 0);
  };

  const navigateTo = (path) => {
    setShowResults(false);
    router.push(path);
  };

  const handleNotificationClick = async (n) => {
    setShowNotifications(false);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id })
    });
    fetchNotifications();
    openBug(n.bugId);
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allForUser: currentReporter })
    });
    fetchNotifications();
  };

  if (!currentReporter) return null;

  return (
    <header className="topbar-v2">
      <div className="topbar-search-column" ref={searchRef} style={{ width: 'min(520px, 50%)', marginRight: 'auto', position: 'relative', display: 'flex' }}>
        <div className="topbar-search">
          <Search size={15} color="var(--color-text-muted)" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search bugs, projects, team…"
            value={globalSearchQuery || ''}
            onChange={handleSearchChange}
            onFocus={() => (globalSearchQuery || '').trim().length > 0 && setShowResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.currentTarget.blur(); setShowResults(false); return; }
              if (!showResults || flatResults.length === 0) {
                if (e.key === 'Enter' && pathname !== '/bugs') navigateTo('/bugs');
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % flatResults.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = flatResults[activeIndex];
                if (target) {
                  if (target.bug) { setShowResults(false); openBug(target.bug); }
                  else if (target.path) navigateTo(target.path);
                }
              }
            }}
          />
        </div>

        {showResults && (
          <div className="topnav-search-dropdown" style={{ top: 'calc(100% + 6px)', left: 0, right: 'auto', width: 'min(520px, 90vw)' }}>
            {!hasResults ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-light)' }}>
                <Search size={20} style={{ opacity: 0.35, marginBottom: 8 }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>No matches for &ldquo;{globalSearchQuery}&rdquo;</div>
              </div>
            ) : (
              <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                {filteredBugs.length > 0 && (
                  <ResultSection title="Bugs">
                    {filteredBugs.map((bug, idx) => {
                      const flatIdx = idx;
                      return (
                        <ResultRow
                          key={bug.id}
                          active={activeIndex === flatIdx}
                          innerRef={(el) => { resultRefs.current[flatIdx] = el; }}
                          onClick={() => { setShowResults(false); openBug(bug); }}>
                          <ResultIcon color="#f43f5e"><Bug size={14} /></ResultIcon>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bug.title}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>{bug.id} · {bug.project}</div>
                          </div>
                          <ChevronRight size={14} color="#cbd5e1" />
                        </ResultRow>
                      );
                    })}
                  </ResultSection>
                )}
                {filteredProjects.length > 0 && (
                  <ResultSection title="Projects">
                    {filteredProjects.map((p, idx) => {
                      const flatIdx = filteredBugs.length + idx;
                      return (
                        <ResultRow
                          key={p}
                          active={activeIndex === flatIdx}
                          innerRef={(el) => { resultRefs.current[flatIdx] = el; }}
                          onClick={() => navigateTo(`/bugs?project=${encodeURIComponent(p)}`)}>
                          <ResultIcon color="var(--color-primary)"><Folder size={14} /></ResultIcon>
                          <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--color-text-main)' }}>{p}</span>
                        </ResultRow>
                      );
                    })}
                  </ResultSection>
                )}
                {filteredMembers.length > 0 && (
                  <ResultSection title="Team">
                    {filteredMembers.map((m, idx) => {
                      const name = typeof m === 'object' ? m.name : m;
                      const flatIdx = filteredBugs.length + filteredProjects.length + idx;
                      return (
                        <ResultRow
                          key={name || idx}
                          active={activeIndex === flatIdx}
                          innerRef={(el) => { resultRefs.current[flatIdx] = el; }}
                          onClick={() => navigateTo('/team')}>
                          <ResultIcon color="#22c55e"><Users size={14} /></ResultIcon>
                          <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--color-text-main)' }}>{capitalizeName(name)}</span>
                        </ResultRow>
                      );
                    })}
                  </ResultSection>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={toggleDarkMode}
        className="topbar-icon-btn"
        title={darkMode ? 'Light mode' : 'Dark mode'}
        aria-label="Toggle theme"
      >
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="topbar-notif" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowNotifications(v => !v)}
          className="topbar-icon-btn"
          aria-label="Notifications"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="topnav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        {showNotifications && (
          <div className="topnav-notif-dropdown">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer' }}>Mark all read</button>
              )}
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifications.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.82rem' }}>
                  You&rsquo;re all caught up.
                </div>
              )}
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border-light)',
                    backgroundColor: n.isRead ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))'
                  }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontWeight: n.isRead ? 400 : 500, marginBottom: 4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{n.bugId}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="topbar-user-menu" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMenu(v => !v)}
          className="topnav-avatar"
          style={{ width: 36, height: 36 }}
          aria-label="User menu"
        >
          {getAvatar(currentReporter)
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={getAvatar(currentReporter)} alt={currentReporter} />
            : <span>{getInitials(currentReporter)}</span>}
        </button>
        {showMenu && (
          <div className="topnav-user-dropdown">
            <Link href="/profile" onClick={() => setShowMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--color-border-light)', textDecoration: 'none' }}>
              <div className="topnav-avatar" style={{ width: 36, height: 36 }}>
                {getAvatar(currentReporter)
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={getAvatar(currentReporter)} alt={currentReporter} />
                  : <span>{getInitials(currentReporter)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {capitalizeName(currentReporter)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{userRole || 'Team Member'}</div>
              </div>
              <ChevronRight size={14} color="var(--color-text-light)" />
            </Link>
            <button
              onClick={() => { setShowMenu(false); handleSwitchUser(); }}
              style={{
                all: 'unset', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', width: '100%', boxSizing: 'border-box',
                color: '#ef4444', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer'
              }}>
              <LogOut size={15} /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function ResultSection({ title, children }) {
  return (
    <div style={{ padding: 6 }}>
      <div style={{ padding: '8px 10px', fontSize: '0.68rem', fontWeight: 500, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      {children}
    </div>
  );
}

function ResultRow({ children, onClick, active, innerRef }) {
  return (
    <div
      ref={innerRef}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 10,
        cursor: 'pointer',
        backgroundColor: active ? 'var(--color-bg-body)' : 'transparent'
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {children}
    </div>
  );
}

function ResultIcon({ color, children }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: color + '18', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>{children}</div>
  );
}
