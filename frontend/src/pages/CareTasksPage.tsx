import { LayoutGrid, List, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { TaskCard } from '../components/ui/TaskCard';
import { cn } from '../lib/cn';
import {
  BOARD_COLUMNS,
  TASK_CATEGORY_ORDER,
  TASK_PRIORITY_ORDER,
  humanLabel,
  priorityColor,
  taskStatusColor,
} from '../lib/domain';
import type { CareTask, CareTasksResponse, DirectoryUser, PatientsResponse } from '../lib/types';
import { useRealtimeEvent } from '../realtime/RealtimeProvider';
import { useApiData } from '../lib/useApi';
import { PageHeader } from './PagePlaceholder';
import { TaskForm } from './tasks/TaskForm';

export default function CareTasksPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'staff';

  const [view, setView] = useState<'board' | 'list'>('board');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [assignee, setAssignee] = useState('');
  const [patient, setPatient] = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', '100');
    if (priority) p.set('priority', priority);
    if (category) p.set('category', category);
    if (assignee) p.set('assignedTo', assignee);
    if (patient) p.set('patient', patient);
    return `/care-tasks?${p.toString()}`;
  }, [priority, category, assignee, patient]);

  const { data, loading, error, refetch } = useApiData<CareTasksResponse>(path);
  const { data: dir } = useApiData<{ users: DirectoryUser[] }>('/directory/users');
  const { data: pts } = useApiData<PatientsResponse>('/patients?limit=100');

  // Live updates: refresh the board when a teammate changes a task.
  useRealtimeEvent('care-task.changed', refetch);

  const userMap = useMemo(
    () => new Map((dir?.users ?? []).map((u) => [u.id, u.name] as const)),
    [dir],
  );
  const patientMap = useMemo(
    () =>
      new Map((pts?.patients ?? []).map((p) => [p.id, `${p.firstName} ${p.lastName}`] as const)),
    [pts],
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CareTask | null>(null);

  const tasks = data?.tasks ?? [];
  const nameOfPatient = (id: string) => patientMap.get(id) ?? '—';
  const nameOfUser = (id?: string | null) => (id ? (userMap.get(id) ?? null) : null);

  function onChanged() {
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Care Tasks"
        subtitle="Track follow-up tasks across the team."
        action={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDrawerOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New task
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {(['board', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize',
                  view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {v === 'board' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                {v}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            <Select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">All priority</option>
              {TASK_PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {humanLabel(p)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {TASK_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {humanLabel(c)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">All assignees</option>
              {(dir?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by patient"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
            >
              <option value="">All patients</option>
              {(pts?.patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading && (
        <Card className="p-10">
          <Skeleton className="h-40 w-full" />
        </Card>
      )}
      {error && !loading && <Card className="p-6 text-sm text-red-700">Could not load tasks.</Card>}

      {!loading &&
        data &&
        (view === 'board' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              return (
                <div key={col} className="rounded-lg bg-slate-100/60 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <Badge color={taskStatusColor[col]} dot>
                      {humanLabel(col)}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-500">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        patientName={nameOfPatient(t.patient)}
                        assigneeName={nameOfUser(t.assignedTo)}
                        onClick={() => {
                          setEditing(t);
                          setDrawerOpen(true);
                        }}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <p className="px-1 py-6 text-center text-xs text-slate-400">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer hover:bg-brand-50/50"
                    onClick={() => {
                      setEditing(t);
                      setDrawerOpen(true);
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{t.title}</td>
                    <td className="px-4 py-3 text-slate-600">{nameOfPatient(t.patient)}</td>
                    <td className="px-4 py-3">
                      <Badge color={priorityColor[t.priority]} dot>
                        {humanLabel(t.priority)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={taskStatusColor[t.status]} dot>
                        {humanLabel(t.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {nameOfUser(t.assignedTo) ?? 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                No tasks match your filters.
              </div>
            )}
          </Card>
        ))}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Task details' : 'New task'}
      >
        <TaskForm
          task={editing ?? undefined}
          patients={pts?.patients ?? []}
          users={dir?.users ?? []}
          onChanged={onChanged}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
