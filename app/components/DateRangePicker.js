"use client";
import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check, X, Clock } from 'lucide-react';

const DateRangePicker = ({ 
  startDate, 
  endDate, 
  onRangeChange, 
  placeholder = "Date Filter"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    onRangeChange(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
    setShowCustom(false);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onRangeChange("", "");
    setShowCustom(false);
    setIsOpen(false);
  };

  const getLabel = () => {
    if (!startDate && !endDate) return placeholder;
    if (startDate && endDate) {
      return `${startDate} - ${endDate}`;
    }
    return startDate ? `From ${startDate}` : `Until ${endDate}`;
  };

  const presetStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: isActive ? '#3b82f6' : '#475569',
    backgroundColor: isActive ? '#eff6ff' : 'transparent',
    transition: 'all 0.2s ease',
    marginBottom: '2px',
    border: 'none',
    width: '100%',
    textAlign: 'left'
  });

  return (
    <div className="date-picker-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', zIndex: isOpen ? 1100 : 1 }}>
      <div
        className={`date-picker-trigger ${isOpen ? 'open' : ''} ${(startDate || endDate) ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 14px',
          backgroundColor: 'white',
          border: `1.5px solid ${isOpen ? '#3b82f6' : '#e2e8f0'}`,
          borderRadius: '10px',
          cursor: 'pointer',
          minWidth: '200px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none'
        }}
      >
        <Calendar size={15} color={(startDate || endDate) ? '#3b82f6' : '#94a3b8'} />
        <span style={{ 
          fontSize: '0.82rem', 
          fontWeight: '700', 
          color: (startDate || endDate) ? '#1e293b' : '#94a3b8',
          flex: 1
        }}>
          {getLabel()}
        </span>
        {(startDate || endDate) && (
          <X size={14} color="#94a3b8" onClick={handleClear} style={{ cursor: 'pointer', transition: 'color 0.2s' }} />
        )}
        <ChevronDown 
          size={14} 
          style={{ 
            transition: 'transform 0.3s ease', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: isOpen ? '#3b82f6' : '#94a3b8' 
          }} 
        />
      </div>

      {isOpen && (
        <div 
          className="date-picker-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '280px',
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 30px -4px rgba(0,0,0,0.12), 0 4px 8px -2px rgba(0,0,0,0.06)',
            padding: '12px',
            zIndex: 1000,
            animation: 'dropdownFadeIn 0.2s ease-out'
          }}
        >
          {/* Presets Section */}
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', padding: '4px 10px', letterSpacing: '0.1em', marginBottom: '4px' }}>Presets</p>
            <button onClick={() => handlePreset(7)} style={presetStyle(false)}>
              <Clock size={14} /> Last 7 Days
            </button>
            <button onClick={() => handlePreset(30)} style={presetStyle(false)}>
              <Clock size={14} /> Last 30 Days
            </button>
            <button onClick={() => handlePreset(60)} style={presetStyle(false)}>
              <Clock size={14} /> Last 60 Days
            </button>
          </div>

          {/* Custom Section - Always Visible */}
          <div style={{ borderTop: '1.5px solid #f1f5f9', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', marginBottom: '12px' }}>
              <Calendar size={13} color="var(--color-primary)" />
              <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Custom Range</p>
            </div>
            
            <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.6rem', fontWeight: '850', color: '#475569', marginLeft: '2px', textTransform: 'uppercase' }}>From</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => onRangeChange(e.target.value, endDate)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    color: '#1e293b',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.6rem', fontWeight: '850', color: '#475569', marginLeft: '2px', textTransform: 'uppercase' }}>To</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => onRangeChange(startDate, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    color: '#1e293b',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                    transition: 'border-color 0.2s'
                  }}
                 />
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px -2px rgba(37,99,235,0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .date-picker-trigger.active {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }
      `}</style>
    </div>
  );
};

export default DateRangePicker;
