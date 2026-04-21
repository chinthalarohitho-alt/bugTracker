"use client";
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const optionName = (o) => (typeof o === 'object' && o !== null ? o.name : o);

const WidgetDropdown = ({
  value,
  onChange,
  selected,
  onSelect,
  options = [],
  isMulti = false,
  label,
  align = 'right',
  fullWidth = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isSelected = (opt) => {
    if (isMulti) {
      if (!Array.isArray(selected)) return false;
      const target = optionName(opt);
      return selected.some(s => optionName(s) === target);
    }
    return opt === value;
  };

  const triggerLabel = (() => {
    if (isMulti) {
      if (!Array.isArray(selected) || selected.length === 0) return label;
      const first = optionName(selected[0]);
      return selected.length > 1 ? `${first} +${selected.length - 1}` : first;
    }
    return value;
  })();

  const hasSelection = isMulti
    ? Array.isArray(selected) && selected.length > 0
    : value !== undefined && value !== null && value !== '';

  const handlePick = (opt) => {
    if (isMulti) {
      onSelect?.(opt);
    } else {
      onChange?.(opt);
    }
    setOpen(false);
  };

  return (
    <div
      className={`custom-dropdown-container${fullWidth ? ' full-width' : ''}`}
      ref={ref}
      style={{ position: 'relative', zIndex: open ? 1100 : 1 }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: '8px 12px', borderRadius: '10px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--chrome-bg-raised)',
          fontSize: '0.78rem', fontWeight: '700',
          color: hasSelection ? 'var(--color-text-main)' : 'var(--color-text-light)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          width: fullWidth ? '100%' : 'auto',
          minWidth: fullWidth ? 0 : '140px',
          whiteSpace: 'nowrap',
          transition: 'background-color 0.15s, border-color 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--chrome-bg-raised)'}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerLabel}</span>
        <span style={{
          fontSize: '0.65rem', opacity: 0.6,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'none'
        }}>▾</span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align]: 0,
            minWidth: '180px',
            maxHeight: '320px',
            overflowY: 'auto',
            backgroundColor: 'var(--chrome-bg-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.03)',
            padding: '6px',
            zIndex: 50,
            transformOrigin: `top ${align}`
          }}>
          {isMulti && (
            <DropdownItem
              selected={!hasSelection}
              onClick={() => { onSelect?.('CLEAR_ALL'); setOpen(false); }}
              label={label || 'All'}
            />
          )}
          {options.map(o => {
            const name = optionName(o);
            const sel = isSelected(o);
            return (
              <DropdownItem
                key={name}
                selected={sel}
                onClick={() => handlePick(o)}
                label={name}
              />
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

const DropdownItem = ({ selected, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%',
      padding: '8px 12px', borderRadius: '8px',
      fontSize: '0.8rem', fontWeight: selected ? '700' : '600',
      color: selected ? 'var(--color-text-main)' : 'var(--color-text-muted)',
      backgroundColor: selected ? 'var(--color-bg-body)' : 'transparent',
      border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', textAlign: 'left',
      transition: 'background-color 0.12s'
    }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--color-bg-body)'; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    {selected && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>✓</span>}
  </button>
);

export default WidgetDropdown;
