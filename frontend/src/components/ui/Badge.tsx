import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeColor = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'indigo' | 'brand';

const colorMap: Record<BadgeColor, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  brand: 'bg-brand-100 text-brand-700',
};

const dotMap: Record<BadgeColor, string> = {
  slate: 'bg-slate-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  brand: 'bg-brand-600',
};

export function Badge({
  color = 'slate',
  dot = false,
  children,
  className,
}: {
  color?: BadgeColor;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        colorMap[color],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotMap[color])} />}
      {children}
    </span>
  );
}

// Role -> pill color, reused wherever a user role is shown.
export const roleColor: Record<string, BadgeColor> = {
  admin: 'brand',
  staff: 'blue',
  viewer: 'slate',
};
