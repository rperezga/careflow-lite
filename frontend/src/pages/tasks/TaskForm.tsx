import { Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, api } from '../../lib/api';
import {
  TASK_CATEGORY_ORDER,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_ORDER,
  humanLabel,
} from '../../lib/domain';
import type {
  CareTask,
  DirectoryUser,
  Patient,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '../../lib/types';

export function TaskForm({
  task,
  patients,
  users,
  onChanged,
  onCancel,
}: {
  task?: CareTask;
  patients: Patient[];
  users: DirectoryUser[];
  onChanged: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const canDelete = user?.role === 'admin';
  const isEdit = Boolean(task);

  const [patient, setPatient] = useState(task?.patient ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'other');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'open');
  const [blockedReason, setBlockedReason] = useState(task?.blockedReason ?? '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '');

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function friendlyError(err: unknown): string {
    if (err instanceof ApiError && err.code === 'patient_not_found')
      return 'That patient no longer exists.';
    if (err instanceof ApiError && err.status === 400)
      return 'Please check the fields and try again.';
    return 'Something went wrong. Please try again.';
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy('create');
    try {
      await api.post('/care-tasks', {
        patient,
        title,
        category,
        priority,
        description: description || undefined,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
      });
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    setError(null);
    setBusy('details');
    try {
      await api.patch(`/care-tasks/${task.id}`, {
        title,
        category,
        priority,
        description: description || undefined,
        dueDate: dueDate || undefined,
      });
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveStatus() {
    if (!task) return;
    if (status === 'blocked' && !blockedReason.trim()) {
      setError('A blocked reason is required.');
      return;
    }
    setError(null);
    setBusy('status');
    try {
      await api.patch(`/care-tasks/${task.id}/status`, {
        status,
        blockedReason: status === 'blocked' ? blockedReason : undefined,
      });
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveAssignee() {
    if (!task) return;
    setError(null);
    setBusy('assign');
    try {
      await api.patch(`/care-tasks/${task.id}/assign`, { assignedTo: assignedTo || null });
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!task) return;
    setBusy('delete');
    try {
      await api.del(`/care-tasks/${task.id}`);
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  }

  const detailFields = (
    <>
      <Field label="Title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
            {TASK_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {humanLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {humanLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Due date">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
    </>
  );

  if (!isEdit) {
    return (
      <form onSubmit={createTask} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Patient" required>
          <Select value={patient} onChange={(e) => setPatient(e.target.value)} required>
            <option value="" disabled>
              Select a patient…
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} · {p.memberId}
              </option>
            ))}
          </Select>
        </Field>
        {detailFields}
        <Field label="Assignee">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={busy === 'create'}>
            Create task
          </Button>
        </div>
      </form>
    );
  }

  const currentPatient = patients.find((p) => p.id === patient);

  return (
    <div className="space-y-6">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <form onSubmit={saveDetails} className="space-y-4">
        <Field label="Patient">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {currentPatient ? `${currentPatient.firstName} ${currentPatient.lastName}` : '—'}
          </div>
        </Field>
        {detailFields}
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={busy === 'details'}>
            Save details
          </Button>
        </div>
      </form>

      <Section title="Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          {TASK_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {humanLabel(s)}
            </option>
          ))}
        </Select>
        {status === 'blocked' && (
          <div className="mt-2">
            <Input
              placeholder="Blocked reason (required)"
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
            />
          </div>
        )}
        {task?.completedAt && status === 'done' && (
          <p className="mt-2 text-xs text-slate-500">
            Completed {new Date(task.completedAt).toLocaleString()}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'status'}
            onClick={() => void saveStatus()}
          >
            Update status
          </Button>
        </div>
      </Section>

      <Section title="Assignee">
        <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'assign'}
            onClick={() => void saveAssignee()}
          >
            Update assignee
          </Button>
        </div>
      </Section>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        {canDelete ? (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete task
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete task?"
        loading={busy === 'delete'}
        message={
          <>
            This permanently removes <span className="font-medium">{task?.title}</span>.
          </>
        }
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {children}
    </div>
  );
}
