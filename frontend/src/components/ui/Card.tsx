import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', className)}>{children}</div>
  );
}
