"use client";
import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Activity, Signal, Folder, Settings, ShieldCheck, ChevronRight } from 'lucide-react';
import GlobalHeader from '../components/GlobalHeader';
import LoadingOverlay from '../components/LoadingOverlay';

export default function SettingsPage() {
  const [settings, setSettings] = useState({ assignees: [], statuses: [], priorities: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [newInputs, setNewInputs] = useState({ assignees: "", statuses: "", priorities: "", projects: "" });

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleAdd = async (category) => {
    const value = newInputs[category].trim();
    if (!value) return;
    
    // Check for duplicates
    if ((settings[category] || []).includes(value)) {
      alert(`This ${category.slice(0, -1)} already exists!`);
      return;
    }

    const currentList = Array.isArray(settings[category]) ? settings[category] : [];
    const updatedSettings = {
      ...settings,
      [category]: [...currentList, value]
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
    if (category === 'assignees' && (itemToDelete === 'Unassigned' || itemToDelete === 'Not Assigned')) {
      alert("System reserved profiles cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${itemToDelete}"? This change is permanent.`)) {
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

  if (loading) return <LoadingOverlay message="System Configuration" subtext="Linking to global data streams..." />;

  const renderSection = (category, title, Icon) => (
    <div className="card" style={{
      padding: '0',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
      border: '1px solid #f1f5f9',
      borderRadius: '16px'
    }}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #f1f5f9',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '10px', color: 'var(--color-primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <Icon size={20} />
          </div>
          <h2 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-primary)', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '99px', border: '1px solid #dbeafe' }}>
          {settings[category]?.length || 0} items
        </span>
      </div>

      <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            className="form-input"
            style={{ flex: 1, backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '10px 14px' }}
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
          const isReserved = category === 'assignees' && (item === 'Unassigned' || item === 'Not Assigned');
          
          return (
            <div key={index} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 24px', borderBottom: '1px solid #f8fafc',
              opacity: isReserved ? 0.7 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChevronRight size={10} color="#cbd5e1" />
                <span style={{ fontSize: '0.9rem', color: isReserved ? '#94a3b8' : '#334155', fontWeight: '600' }}>
                    {item} {isReserved && <span style={{fontSize: '0.65rem', fontWeight: '800', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px'}}>SYSTEM</span>}
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
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Plus size={24} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>No items defined.</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '80px', paddingLeft: '20px', paddingRight: '20px' }}>
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
            <h1 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1e293b', letterSpacing: '-0.02em' }}>Drop Tracker Settings</h1>
          </div>
        </div>
        <p style={{ opacity: 0.6, fontSize: '1rem', marginLeft: '52px', fontWeight: '500' }}>Micro-configure your team lifecycle and status mapping.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {renderSection('assignees', 'Assigned Members', Users)}
        {renderSection('statuses', 'Active Statuses', Activity)}
        {renderSection('priorities', 'Priority Levels', Signal)}
        {renderSection('projects', 'Project Domains', Folder)}
      </div>

      <div style={{ marginTop: '48px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <ShieldCheck size={28} color="#22c55e" />
        <div>
          <h4 style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.9rem' }}>System Integrity Enforced</h4>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>All changes made here will reflect globally across all active bug reports and filters immediately.</p>
        </div>
      </div>

      <style jsx>{`
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
