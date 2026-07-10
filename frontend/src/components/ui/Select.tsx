import type { SelectHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
          'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
