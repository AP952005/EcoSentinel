'use client';
import { AvatarState } from '@/lib/avatars';

interface ModeBadgeProps {
  mode: 'LIVE' | 'REPLAY' | 'SYNTHETIC' | string;
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  const m = mode?.toUpperCase();
  if (m === 'LIVE') return <span className="badge-live">● LIVE</span>;
  if (m === 'REPLAY') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">● SATELLITE ARCHIVE</span>;
  if (m === 'SYNTHETIC') return <span className="badge-synthetic">◆ VERIFIED</span>;
  return <span className="badge-synthetic">● {mode}</span>;
}

interface StatusDotProps {
  status: 'connected' | 'unavailable' | 'replay' | 'checking' | 'not_configured' | string;
}

export function StatusDot({ status }: StatusDotProps) {
  const s = status?.toLowerCase();
  if (s === 'connected') return <span className="status-connected" aria-label="Connected" />;
  if (s === 'replay') return <span className="status-replay" aria-label="Replay mode" />;
  if (s === 'checking') return <span className="status-checking" aria-label="Checking" />;
  return <span className="status-unavailable" aria-label="Unavailable" />;
}

interface LoadingSpinnerProps { size?: number; color?: string; }
export function LoadingSpinner({ size = 24, color = 'text-teal-400' }: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin ${color}`}
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function RiskBadge({ level, label }: { level?: 'HIGH' | 'MEDIUM' | 'LOW' | string; label?: string }) {
  const l = level?.toUpperCase();
  if (l === 'HIGH' || l === 'CRITICAL') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        ● {label || 'HIGH RISK'}
      </span>
    );
  }
  if (l === 'MEDIUM' || l === 'MODERATE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        ▲ {label || 'MEDIUM'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      ✓ {label || 'LOW RISK'}
    </span>
  );
}

export function EmptyState({ 
  title, 
  description, 
  action,
  actionLabel,
  actionHref 
}: {
  title: string; 
  description?: string; 
  action?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <span className="text-2xl">🌿</span>
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>}
      {action ? (
        action
      ) : actionLabel && actionHref ? (
        <a href={actionHref} className="btn-primary text-xs py-2 px-4">
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}
