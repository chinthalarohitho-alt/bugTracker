"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bug, LayoutDashboard, FolderKanban, BarChart3, Users, Settings, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentReporter, getInitials, handleSwitchUser } = useAuth();

  if (!currentReporter) return null;

  return (
    <aside className="layout-sidebar">
      <div className="sidebar-header">
        <div style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
          <Bug size={22} strokeWidth={2.5} />
        </div>
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
      </nav>

      <div className="sidebar-footer" style={{ padding: '12px' }}>
        <div className="user-profile" style={{ border: '1px solid var(--color-border-light)', padding: '10px 8px' }}>
          <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '0.85rem', fontWeight: '800', backgroundColor: 'var(--color-primary)', color: 'white' }}>
            {getInitials(currentReporter)}
          </div>
          <div style={{ flex: 1, marginLeft: '8px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {currentReporter}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>Team Member</div>
          </div>
        </div>

        <button
          onClick={handleSwitchUser}
          className="sidebar-link"
          style={{ marginTop: '10px', width: '100%', border: '1px solid var(--color-border-light)', justifyContent: 'center', gap: '6px', fontSize: '0.8rem' }}
        >
          <LogOut size={14} /> Switch User
        </button>
      </div>
    </aside>
  );
}

