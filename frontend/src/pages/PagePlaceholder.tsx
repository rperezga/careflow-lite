import type { ReactNode } from 'react';
import { Card } from '../components/ui/Card';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ComingSoon({ issue }: { issue: string }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm font-medium text-slate-700">This screen is coming soon.</p>
      <p className="mt-1 text-sm text-slate-500">
        Built on the finished API — arriving in {issue}.
      </p>
    </Card>
  );
}
