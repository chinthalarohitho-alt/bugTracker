"use client";
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomDropdown = ({
  label,
  options = [],
  selected,
  onSelect,
  isMulti = false,
  fullWidth = false,
  placeholder = "Select...",
  style = {},
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        if (onClose) onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const isSelected = (opt) => {
    if (isMulti) return Array.isArray(selected) && selected.includes(opt);
    return selected === opt;
  };

  const handleSelect = (opt) => {
    onSelect(opt);
    if (!isMulti) {
      setIsOpen(false);
      if (onClose) onClose();
    }
  };

  const getTriggerLabel = () => {
    if (isMulti) {
      if (!Array.isArray(selected) || selected.length === 0) return label || placeholder;
      const val = selected[0];
      const name = typeof val === 'object' ? val.name : val;
      return selected.length > 1 ? `${name} +${selected.length - 1}` : name;
    }
    const val = selected || placeholder;
    return typeof val === 'object' ? val.name : val;
  };

  return (
    <div 
      className={`custom-dropdown-container ${fullWidth ? 'full-width' : ''}`} 
      ref={dropdownRef}
      style={{ ...style, zIndex: isOpen ? 1100 : 1 }}
    >
      <div
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${isSelected(selected) ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: 'var(--color-bg-surface)',
          border: `1.5px solid ${isOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: '10px',
          cursor: 'pointer',
          minWidth: fullWidth ? '100%' : '160px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? '0 0 0 4px color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'none'
        }}
      >
        <span style={{ 
          fontSize: '0.85rem', 
          fontWeight: '600', 
          color: (isMulti ? (Array.isArray(selected) && selected.length > 0) : selected) ? 'var(--color-text-main)' : 'var(--color-text-light)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {getTriggerLabel()}
        </span>
        <ChevronDown 
          size={14} 
          style={{ 
            transition: 'transform 0.3s ease', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: isOpen ? 'var(--color-primary)' : 'var(--color-text-light)'
          }} 
        />
      </div>

      {isOpen && (
        <div 
          className="custom-dropdown-menu visible"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '100%',
            minWidth: '100%',
            backgroundColor: 'var(--chrome-bg-raised)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 12px 30px -4px rgba(0,0,0,0.2), 0 4px 8px -2px rgba(0,0,0,0.1)',
            padding: '6px',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
            animation: 'dropdownFadeIn 0.2s ease-out'
          }}
        >
          {/* "Clear All" or "Show All" option for multi-select */}
          {isMulti && (
            <div
              className={`custom-dropdown-item ${Array.isArray(selected) && selected.length === 0 ? 'selected' : ''}`}
              onClick={() => handleSelect('CLEAR_ALL')}
              style={itemStyle(Array.isArray(selected) && selected.length === 0)}
            >
              <span>{label || 'All'}</span>
              {(Array.isArray(selected) && selected.length === 0) && <Check size={14} color="var(--color-primary)" strokeWidth={3} />}
            </div>
          )}

          {options?.map(opt => {
            const isObject = typeof opt === 'object';
            const optValue = isObject ? opt.name : opt;
            const isSubItem = !isObject && (opt.startsWith(' -') || opt.startsWith(' •'));
            const displayText = isSubItem ? opt.substring(2) : optValue;
            
            return (
              <div
                key={optValue}
                className={`custom-dropdown-item ${isSelected(opt) ? 'selected' : ''}`}
                onClick={() => handleSelect(opt)}
                style={itemStyle(isSelected(opt), isSubItem)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  {isMulti && (
                    <div style={{ 
                      width: '16px', height: '16px', borderRadius: '4px', 
                      border: `1.5px solid ${isSelected(opt) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      backgroundColor: isSelected(opt) ? 'var(--color-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {isSelected(opt) && <Check size={12} color="white" strokeWidth={3} />}
                    </div>
                  )}
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayText}</span>
                </div>
                {!isMulti && isSelected(opt) && <Check size={14} color="var(--color-primary)" strokeWidth={3} />}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .custom-dropdown-container {
          position: relative;
          display: inline-block;
        }
        .custom-dropdown-container.full-width {
          display: block;
          width: 100%;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        ::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

const itemStyle = (isSelected, isSubItem = false) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  paddingLeft: isSubItem ? '32px' : '12px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: isSubItem ? '0.8rem' : '0.85rem',
  fontWeight: isSelected ? '700' : (isSubItem ? '500' : '600'),
  color: isSelected ? 'var(--color-primary)' : (isSubItem ? 'var(--color-text-light)' : 'var(--color-text-muted)'),
  backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
  opacity: isSubItem && !isSelected ? 0.85 : 1,
  transition: 'all 0.2s ease',
  marginBottom: '2px',
  '&:hover': {
    backgroundColor: 'var(--color-bg-body)',
    color: 'var(--color-primary)'
  }
});

export default CustomDropdown;
