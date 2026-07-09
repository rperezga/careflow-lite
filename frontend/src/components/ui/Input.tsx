import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
        'focus:outline-none focus:ring-2',
        invalid
          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
          : 'border-slate-300 focus:border-brand-600 focus:ring-brand-600/30',
        className,
      )}
      {...rest}
    />
  );
});
