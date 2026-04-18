"use client";

export default function PageHeader({
  title,
  subtitle,
  actions,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 className="page-heading-title">{title}</h1>
        {subtitle && <p className="page-heading-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
