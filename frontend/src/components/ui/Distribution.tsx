import type { BadgeColor } from './Badge';
import { cn } from '../../lib/cn';

const barColor: Record<BadgeColor, string> = {
  slate: 'bg-slate-400',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  brand: 'bg-brand-600',
};

export interface DistributionRow {
  label: string;
  count: number;
  color: BadgeColor;
}

export function Distribution({ rows, total }: { rows: DistributionRow[]; total: number }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-600">{r.label}</span>
              <span className="font-semibold text-slate-900">{r.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full', barColor[r.color])}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
