import type { CareTask } from '../../lib/types';
import { humanLabel, priorityColor } from '../../lib/domain';
import { cn } from '../../lib/cn';
import { Badge } from './Badge';

function isOverdue(task: CareTask): boolean {
  if (!task.dueDate || task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function TaskCard({
  task,
  patientName,
  assigneeName,
  onClick,
}: {
  task: CareTask;
  patientName: string;
  assigneeName: string | null;
  onClick: () => void;
}) {
  const overdue = isOverdue(task);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-300"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{task.title}</p>
        <Badge color={priorityColor[task.priority]} dot>
          {humanLabel(task.priority)}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">{patientName}</p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">{humanLabel(task.category)}</span>
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={cn(overdue ? 'font-semibold text-red-600' : 'text-slate-400')}>
              {overdue ? 'Overdue' : new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          <span className="text-slate-500">{assigneeName ?? 'Unassigned'}</span>
        </div>
      </div>
    </button>
  );
}
