"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bug, LayoutDashboard, FolderKanban, BarChart3, Settings, LogOut, Moon, Sun, Users } from 'lucide-react';
import { useAuth, capitalizeName } from './AuthProvider';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentReporter, getAvatar, getInitials, handleSwitchUser, userRole } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('bugTracker_theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('bugTracker_theme', next ? 'dark' : 'light');
  };

  if (!currentReporter) return null;

  return (
    <aside className="layout-sidebar">
      <div className="sidebar-header">
        <img src="/tapzaLogo.png" alt="Tapza" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <div className="sidebar-brand" style={{ marginLeft: '1px' }}>
          Tapza Bug portal
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link href="/" className={`sidebar-link ${pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={18} /> Dashboard
        </Link>
        <Link href="/bugs" className={`sidebar-link ${pathname === '/bugs' ? 'active' : ''}`}>
          <Bug size={18} /> Bugs
        </Link>
        <Link href="/projects" className={`sidebar-link ${pathname === '/projects' ? 'active' : ''}`}>
          <FolderKanban size={18} /> Projects
        </Link>
        <Link href="/analytics" className={`sidebar-link ${pathname === '/analytics' ? 'active' : ''}`}>
          <BarChart3 size={18} /> Analytics
        </Link>
        <Link href="/settings" className={`sidebar-link ${pathname === '/settings' ? 'active' : ''}`}>
          <Settings size={18} /> Settings
        </Link>
        <Link href="/team" className={`sidebar-link ${pathname === '/team' ? 'active' : ''}`}>
          <Users size={18} /> Team Members
        </Link>
      </nav>

      <div className="sidebar-footer" style={{ padding: '12px' }}>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="sidebar-link"
          style={{
            width: '100%', border: '1px solid var(--color-border-light)',
            justifyContent: 'center', gap: '8px', fontSize: '0.8rem',
            marginBottom: '10px', padding: '8px'
          }}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>

        <Link href="/profile" className="user-profile" style={{ border: '1px solid var(--color-border-light)', padding: '10px 8px', textDecoration: 'none', cursor: 'pointer' }}>
          <div
            className="avatar"
            style={{
              width: '38px', height: '38px',
              backgroundColor: '#2563eb', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: '800',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              overflow: 'hidden', position: 'relative'
            }}
          >
            {getAvatar(currentReporter) && (
              <img
                src={getAvatar(currentReporter)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {getInitials(currentReporter)}
          </div>
          <div style={{ flex: 1, marginLeft: '8px', minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {capitalizeName(currentReporter)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>{userRole || 'Team Member'}</div>
          </div>
        </Link>

        <button
          onClick={handleSwitchUser}
          className="sidebar-link"
          style={{ marginTop: '10px', width: '100%', border: '1px solid color-mix(in srgb, #ef4444 20%, var(--color-bg-surface))', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', color: '#ef4444' }}
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </aside>
  );
}
