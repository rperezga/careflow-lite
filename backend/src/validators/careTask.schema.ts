import { z } from 'zod';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from '../models/CareTask';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'invalid_object_id');

// A task is blocked only with a reason attached.
function requireReasonWhenBlocked<T extends { status?: string; blockedReason?: string }>(
  data: T,
  ctx: z.RefinementCtx,
): void {
  if (data.status === 'blocked' && !data.blockedReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blockedReason'],
      message: 'blockedReason is required when status is blocked',
    });
  }
}

export const createTaskSchema = z
  .object({
    patient: objectId,
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.enum(TASK_CATEGORIES).default('other'),
    priority: z.enum(TASK_PRIORITIES).default('medium'),
    status: z.enum(TASK_STATUSES).default('open'),
    assignedTo: objectId.optional(),
    dueDate: z.coerce.date().optional(),
    blockedReason: z.string().min(1).optional(),
  })
  .superRefine(requireReasonWhenBlocked);

// General update: descriptive fields only. Status and assignment have their own
// endpoints so their audit trail (task.status_change, task.assign) stays precise.
export const updateTaskSchema = z
  .object({
    title: z.string().min(1),
    description: z.string(),
    category: z.enum(TASK_CATEGORIES),
    priority: z.enum(TASK_PRIORITIES),
    dueDate: z.coerce.date(),
  })
  .partial();

export const statusSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
    blockedReason: z.string().min(1).optional(),
  })
  .superRefine(requireReasonWhenBlocked);

// assignedTo: a user id to assign, or null to clear the assignment.
export const assignSchema = z.object({
  assignedTo: objectId.nullable(),
});

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  patient: objectId.optional(),
  assignedTo: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
