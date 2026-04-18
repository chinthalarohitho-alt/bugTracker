"use client";
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const PREVIEW_COUNT = 3;
const SCROLL_THRESHOLD = 6;
const SCROLL_MAX_HEIGHT = 360;

export function CollapsibleList({
  items, renderItem, emptyMessage,
  previewCount = PREVIEW_COUNT,
  scrollThreshold = SCROLL_THRESHOLD,
  scrollMaxHeight = SCROLL_MAX_HEIGHT,
  alwaysExpanded = false
}) {
  const [expanded, setExpanded] = useState(false);
  const count = items.length;
  const isExpanded = alwaysExpanded || expanded;
  const visible = isExpanded ? items : items.slice(0, previewCount);
  const hiddenCount = count - visible.length;
  const shouldScroll = isExpanded && count > scrollThreshold;

  return (
    <>
      <div
        className={shouldScroll ? 'collapsible-scroll' : ''}
        style={{
          display: 'flex', flexDirection: 'column',
          borderTop: '1px solid var(--chrome-border)',
          maxHeight: shouldScroll ? scrollMaxHeight : 'none',
          overflowY: shouldScroll ? 'auto' : 'visible',
          borderBottom: shouldScroll ? '1px solid var(--chrome-border)' : 'none',
          paddingRight: shouldScroll ? 4 : 0
        }}>
        {count === 0 && emptyMessage && (
          <div style={{ padding: '20px 8px', color: 'var(--color-text-light)', fontSize: '0.84rem' }}>
            {emptyMessage}
          </div>
        )}
        {visible.map(item => renderItem(item))}
      </div>
      {!alwaysExpanded && count > previewCount && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 8, padding: '6px 12px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem', fontWeight: 500,
            alignSelf: 'flex-start'
          }}>
          <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
      <style jsx global>{`
        .collapsible-scroll { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
        .collapsible-scroll::-webkit-scrollbar { width: 10px; }
        .collapsible-scroll::-webkit-scrollbar-track { background: transparent; }
        .collapsible-scroll::-webkit-scrollbar-thumb {
          background-color: var(--color-border);
          border-radius: 999px;
          border: 2px solid var(--color-bg-body);
        }
        .collapsible-scroll::-webkit-scrollbar-thumb:hover { background-color: var(--color-text-muted); }
      `}</style>
    </>
  );
}

export default function CollapsibleSection({
  icon: Icon, color, label, hint, items, renderItem,
  marginTop = 20, previewCount = PREVIEW_COUNT
}) {
  return (
    <section style={{ marginTop }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {Icon && <Icon size={15} color={color} strokeWidth={2} />}
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-main)' }}>{label}</div>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600,
          color: 'var(--color-text-muted)',
          backgroundColor: 'var(--chrome-bg-subtle)',
          padding: '1px 9px', borderRadius: 999
        }}>{items.length}</span>
        {hint && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>· {hint}</span>}
      </div>
      <CollapsibleList items={items} renderItem={renderItem} previewCount={previewCount} />
    </section>
  );
}
