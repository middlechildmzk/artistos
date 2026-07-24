import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({ children, tone = '' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Metric({ value, label }: { value: ReactNode; label: string }) {
  return <div className="card metric"><strong>{value}</strong><span>{label}</span></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="topbar"><div><div className="eyebrow">{eyebrow}</div><h1 style={{fontSize:'clamp(2rem,4vw,3.2rem)'}}>{title}</h1><p className="muted" style={{marginBottom:0}}>{description}</p></div>{actions}</header>;
}

export function ErrorNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="notice danger">{message}</div>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = (status ?? 'unknown').toLowerCase();
  const tone = ['done','connected','verified','placed','accepted','published','ready'].includes(normalized) ? 'green' : ['blocked','failed','declined','suppressed'].includes(normalized) ? 'red' : 'amber';
  return <Badge tone={tone}>{normalized.replaceAll('_',' ')}</Badge>;
}
