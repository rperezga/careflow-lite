import { Card } from '../components/ui/Card';

export default function ForbiddenPage() {
  return (
    <Card className="mx-auto max-w-lg p-10 text-center">
      <p className="text-3xl font-bold text-slate-900">403</p>
      <p className="mt-2 text-sm font-medium text-slate-700">No access</p>
      <p className="mt-1 text-sm text-slate-500">You do not have permission to view this page.</p>
    </Card>
  );
}
