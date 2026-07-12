import { Activity, AlertTriangle, ClipboardList, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Distribution } from '../components/ui/Distribution';
import { Skeleton } from '../components/ui/Skeleton';
import { StatCard } from '../components/ui/StatCard';
import {
  humanLabel,
  priorityColor,
  RISK_ORDER,
  riskColor,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_ORDER,
  taskStatusColor,
} from '../lib/domain';
import { timeAgo } from '../lib/time';
import type { DashboardSummary } from '../lib/types';
import { useRealtimeEvent } from '../realtime/RealtimeProvider';
import { useApiData } from '../lib/useApi';
import { PageHeader } from './PagePlaceholder';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApiData<DashboardSummary>('/dashboard/summary');

  // Live updates: the snapshot re-aggregates when anything changes.
  useRealtimeEvent('care-task.changed', refetch);
  useRealtimeEvent('patient.changed', refetch);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.name ?? ''}.`} />
      {loading && <DashboardSkeleton />}
      {error && !loading && (
        <Card className="p-6 text-sm font-medium text-red-700">
          Could not load the dashboard. Please try again.
        </Card>
      )}
      {data && !loading && <DashboardContent data={data} />}
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const { patients, tasks, recentActivity } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Patients"
          value={patients.total}
          accent="brand"
          icon={<Users className="h-5 w-5" />}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {RISK_ORDER.map((r) => (
              <span key={r} className="inline-flex items-center gap-1">
                <Badge color={riskColor[r]} dot>
                  {humanLabel(r)}
                </Badge>
                <span className="text-xs font-medium text-slate-500">
                  {patients.byRisk[r] ?? 0}
                </span>
              </span>
            ))}
          </div>
        </StatCard>

        <StatCard
          label="Open tasks"
          value={tasks.byStatus.open ?? 0}
          accent="blue"
          icon={<ClipboardList className="h-5 w-5" />}
        />

        <StatCard
          label="Overdue tasks"
          value={tasks.overdue}
          accent="red"
          icon={<AlertTriangle className="h-5 w-5" />}
        >
          <span className="text-xs font-medium text-red-600">Action required</span>
        </StatCard>

        <StatCard
          label="Unassigned"
          value={tasks.unassigned}
          accent="indigo"
          icon={<UserPlus className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Tasks overview</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                By status
              </p>
              <Distribution
                total={tasks.total}
                rows={TASK_STATUS_ORDER.map((s) => ({
                  label: humanLabel(s),
                  count: tasks.byStatus[s] ?? 0,
                  color: taskStatusColor[s] ?? 'slate',
                }))}
              />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                By priority
              </p>
              <Distribution
                total={tasks.total}
                rows={TASK_PRIORITY_ORDER.map((p) => ({
                  label: humanLabel(p),
                  count: tasks.byPriority[p] ?? 0,
                  color: priorityColor[p] ?? 'slate',
                }))}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Activity className="h-5 w-5 text-brand-600" /> Recent activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="space-y-4">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <p className="text-sm text-slate-700">{a.summary}</p>
                    <p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <Skeleton className="h-40 w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    </div>
  );
}
