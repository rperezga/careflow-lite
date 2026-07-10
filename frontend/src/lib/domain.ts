import type { BadgeColor } from '../components/ui/Badge';

// Canonical orderings for display (match the backend enums).
export const RISK_ORDER = ['high', 'medium', 'low'] as const;
export const TASK_STATUS_ORDER = ['open', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
export const TASK_PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'] as const;

// Semantic pill colors, reused across every screen.
export const riskColor: Record<string, BadgeColor> = {
  low: 'green',
  medium: 'amber',
  high: 'red',
};
export const patientStatusColor: Record<string, BadgeColor> = {
  active: 'green',
  inactive: 'slate',
};
export const taskStatusColor: Record<string, BadgeColor> = {
  open: 'blue',
  in_progress: 'indigo',
  blocked: 'red',
  done: 'green',
  cancelled: 'slate',
};
export const priorityColor: Record<string, BadgeColor> = {
  urgent: 'red',
  high: 'orange',
  medium: 'blue',
  low: 'slate',
};

// "in_progress" -> "In progress"
export function humanLabel(value: string): string {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const TASK_CATEGORY_ORDER = [
  'follow_up',
  'documentation',
  'access_issue',
  'medication',
  'appointment',
  'billing',
  'other',
] as const;

// Columns shown on the task board (cancelled tasks appear only in the list view).
export const BOARD_COLUMNS = ['open', 'in_progress', 'blocked', 'done'] as const;
