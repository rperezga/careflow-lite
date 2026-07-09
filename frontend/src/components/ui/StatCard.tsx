import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Accent = 'brand' | 'blue' | 'red' | 'indigo' | 'amber' | 'green';

const accentBar: Record<Accent, string> = {
  brand: 'bg-brand-600',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
};

export function StatCard({
  label,
  value,
  accent = 'brand',
  icon,
  children,
}: {
  label: string;
  value: ReactNode;
  accent?: Accent;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5">
      <span className={cn('absolute inset-y-0 left-0 w-1', accentBar[accent])} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
