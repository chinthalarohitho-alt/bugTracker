"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';

const AdvancedDateFilter = ({ 
  startDate, 
  endDate, 
  onRangeChange, 
  placeholder = "Date Filter"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [operator, setOperator] = useState('between'); // 'is', 'before', 'after', 'between'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isOpDropdownOpen, setIsOpDropdownOpen] = useState(false);
  
  const dropdownRef = useRef(null);
  const operatorRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsOpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const operators = [
    { id: 'is', label: 'Is' },
    { id: 'before', label: 'Is before' },
    { id: 'after', label: 'Is after' },
    { id: 'on_or_before', label: 'Is on or before' },
    { id: 'on_or_after', label: 'Is on or after' },
    { id: 'between', label: 'Is in between' }
  ];

  const handleDateClick = (dateStr) => {
    if (operator === 'between') {
      if (!startDate || (startDate && endDate)) {
        onRangeChange(dateStr, "");
      } else {
        const start = new Date(startDate);
        const end = new Date(dateStr);
        if (end < start) {
          onRangeChange(dateStr, startDate);
        } else {
          onRangeChange(startDate, dateStr);
        }
      }
    } else if (operator === 'is') {
      onRangeChange(dateStr, dateStr);
    } else if (operator.includes('before')) {
      onRangeChange("", dateStr);
    } else if (operator.includes('after')) {
      onRangeChange(dateStr, "");
    }
  };

  const generateMonthData = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Adjust for Monday start if needed, but standard CRM usually uses Sunday/Monday.
    // Reference shows MON TUE... SUN so Monday start.
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; 

    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i).toISOString().split('T')[0]);
    }
    return { name: date.toLocaleString('default', { month: 'long', year: 'numeric' }), days };
  };

  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  const isRange = operator === 'between';
  const months = isRange ? [generateMonthData(currentMonth), generateMonthData(nextMonth)] : [generateMonthData(currentMonth)];

  const isSelected = (dateStr) => dateStr === startDate || dateStr === endDate;
  const isInRange = (dateStr) => {
    if (!startDate || !endDate || !dateStr) return false;
    return dateStr > startDate && dateStr < endDate;
  };

  const getTriggerLabel = () => {
    if (!startDate && !endDate) return placeholder;
    const op = operators.find(o => o.id === operator)?.label || "Date";
    if (operator === 'between') return `${op}: ${startDate || '...'} - ${endDate || '...'}`;
    return `${op}: ${startDate || endDate}`;
  };

  const [localStart, setLocalStart] = useState(startDate || "");
  const [localEnd, setLocalEnd] = useState(endDate || "");

  useEffect(() => { 
    setLocalStart(startDate || ""); 
    if (!startDate && !endDate) setOperator('between'); // Reset to default when cleared
  }, [startDate, endDate]);
  useEffect(() => { setLocalEnd(endDate || ""); }, [endDate]);

  const handleManualEntry = (val, type) => {
    const isStart = type === 'start';
    if (isStart) setLocalStart(val); else setLocalEnd(val);

    // Try to parse YYYY-MM-DD or DD-MM-YYYY
    let normalized = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      normalized = val;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const [d, m, y] = val.split('-');
      normalized = `${y}-${m}-${d}`;
    }

    if (normalized && !isNaN(new Date(normalized).getTime())) {
      if (isStart) {
        onRangeChange(normalized, endDate);
        // Auto-close if not a range operator
        if (operator !== 'between') setIsOpen(false);
        // Auto-close if second date already exists
        else if (endDate) setIsOpen(false);
      } else {
        onRangeChange(startDate, normalized);
        // Auto-close in between mode if start exists
        if (startDate) setIsOpen(false);
      }
    }
  };

  return (
    <div className="date-filter-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        className={`date-filter-trigger ${isOpen ? 'open' : ''} ${(startDate || endDate) ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
          backgroundColor: (startDate || endDate) ? 'color-mix(in srgb, #3b82f6 10%, var(--color-bg-surface))' : 'var(--color-bg-surface)',
          border: `1.5px solid ${isOpen ? '#3b82f6' : (startDate || endDate ? '#3b82f6' : '#e2e8f0')}`,
          borderRadius: '12px', cursor: 'pointer', minWidth: '220px', transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none'
        }}
      >
        <CalendarIcon size={16} color={(startDate || endDate) ? '#3b82f6' : '#94a3b8'} />
        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: (startDate || endDate) ? 'var(--color-text-main)' : 'var(--color-text-light)', flex: 1 }}>
          {getTriggerLabel()}
        </span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s', color: 'var(--color-text-light)' }} />
      </div>

      {isOpen && (
        <div 
          className="crisply-popover"
          style={{
            position: 'absolute', top: 'calc(100% + 12px)', left: 0, width: isRange ? '540px' : '280px',
            backgroundColor: 'var(--chrome-bg-raised)', borderRadius: '16px', border: '1px solid var(--color-border)',
            boxShadow: '0 20px 50px -12px rgba(0,0,0,0.15)', padding: '18px', zIndex: 2000,
            animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Popover Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text-muted)' }}>Date</span>
              <div style={{ position: 'relative' }} ref={operatorRef}>
                <button 
                  onClick={() => setIsOpDropdownOpen(!isOpDropdownOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))', color: '#3b82f6', border: 'none', borderRadius: '8px',
                    fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  {operators.find(o => o.id === operator)?.label} <ChevronDown size={12} />
                </button>
                {isOpDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', width: '200px', backgroundColor: 'var(--chrome-bg-raised)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--color-border-light)', zIndex: 2100 }}>
                    {operators.map(op => (
                      <div 
                        key={op.id} 
                        onClick={() => { setOperator(op.id); setIsOpDropdownOpen(false); }}
                        style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: '600', color: operator === op.id ? '#3b82f6' : 'var(--color-text-main)', cursor: 'pointer', backgroundColor: operator === op.id ? 'color-mix(in srgb, #3b82f6 10%, var(--color-bg-surface))' : 'transparent' }}
                      >
                        {op.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => { onRangeChange("", ""); setOperator('between'); setIsOpen(false); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
            >
              Delete
            </button>
          </div>

          {/* Input Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                value={localStart} 
                onChange={(e) => handleManualEntry(e.target.value, 'start')}
                placeholder={operator.includes('before') ? '...' : 'Start...'}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--color-border)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none' }}
              />
              {startDate && <X size={12} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--color-text-light)' }} onClick={() => onRangeChange("", endDate)} />}
            </div>
            {operator === 'between' && (
              <>
                <div style={{ fontSize: '1rem', color: 'var(--color-text-light)' }}>-</div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input 
                    value={localEnd}
                    onChange={(e) => handleManualEntry(e.target.value, 'end')}
                    placeholder="End..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--color-border)', fontSize: '0.8rem', fontWeight: '600', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', outline: 'none' }}
                  />
                  {endDate && <X size={12} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--color-text-light)' }} onClick={() => onRangeChange(startDate, "")} />}
                </div>
              </>
            )}
          </div>

          {/* Calendar Area */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {months.map((month, mIdx) => (
              <div key={mIdx} style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  {mIdx === 0 && <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={{ padding: '6px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 10%, var(--color-bg-surface))', color: 'var(--color-text-main)', cursor: 'pointer' }}><ChevronLeft size={14} /></button>}
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-text-main)', textAlign: 'center', flex: 1 }}>{month.name}</span>
                  {(mIdx === months.length - 1) && <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={{ padding: '6px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 10%, var(--color-bg-surface))', color: 'var(--color-text-main)', cursor: 'pointer' }}><ChevronRight size={14} /></button>}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
                    <span key={d} style={{ fontSize: '0.6rem', fontWeight: '800', color: 'var(--color-text-light)', paddingBottom: '8px' }}>{d}</span>
                  ))}
                  {month.days.map((day, dIdx) => {
                    const active = isSelected(day);
                    const ranged = isInRange(day);
                    return (
                      <div 
                        key={dIdx} 
                        onClick={() => day && handleDateClick(day)}
                        style={{
                          height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: active ? '800' : '600', 
                          color: active ? 'white' : (day ? 'var(--color-text-main)' : 'transparent'),
                          backgroundColor: active ? '#3b82f6' : (ranged ? 'color-mix(in srgb, #3b82f6 15%, transparent)' : 'transparent'),
                          borderRadius: '8px', cursor: day ? 'pointer' : 'default', transition: 'all 0.1s',
                          border: active ? '2px solid #3b82f6' : '2px solid transparent'
                        }}
                      >
                        {day ? new Date(day).getDate() : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      <style jsx>{`
        @keyframes popIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default AdvancedDateFilter;
