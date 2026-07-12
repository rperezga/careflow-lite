import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { CareTask } from '../models/CareTask';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { broadcast } from '../realtime/hub';
import { recordAudit } from '../services/audit.service';
import { asyncHandler } from '../utils/asyncHandler';
import {
  assignSchema,
  createTaskSchema,
  listTasksQuerySchema,
  statusSchema,
  updateTaskSchema,
} from '../validators/careTask.schema';

export const careTasksRouter = Router();

// Every care-task route requires a valid session.
careTasksRouter.use(requireAuth);

// List care tasks with optional filters and pagination. Any authenticated role reads.
careTasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listTasksQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const { status, priority, category, patient, assignedTo, page, limit } = parsed.data;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (patient) filter.patient = patient;
    if (assignedTo) filter.assignedTo = assignedTo;

    const [tasks, total] = await Promise.all([
      CareTask.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      CareTask.countDocuments(filter),
    ]);

    res.json({ tasks, total, page, limit });
  }),
);

// Get one care task by id.
careTasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await findTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ task });
  }),
);

// Create a care task. Staff and admins manage tasks; viewers cannot.
careTasksRouter.post(
  '/',
  requireRole('admin', 'staff'),
  asyncHandler(async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;

    // Referential integrity: Mongo has no foreign keys, so check refs ourselves.
    if (!(await Patient.exists({ _id: data.patient }))) {
      res.status(400).json({ error: 'patient_not_found' });
      return;
    }
    if (data.assignedTo && !(await User.exists({ _id: data.assignedTo }))) {
      res.status(400).json({ error: 'assignee_not_found' });
      return;
    }

    const task = await CareTask.create({ ...data, createdBy: req.user!.id });
    await recordAudit({
      actor: req.user!.id,
      action: 'task.create',
      entityType: 'care_task',
      entityId: task.id,
      summary: `Created task "${task.title}"`,
    });
    broadcast({ type: 'care-task.changed', action: 'create', id: task.id });
    res.status(201).json({ task });
  }),
);

// Update descriptive fields only (title, description, category, priority, dueDate).
careTasksRouter.patch(
  '/:id',
  requireRole('admin', 'staff'),
  asyncHandler(async (req, res) => {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const task = await findTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    Object.assign(task, parsed.data);
    await task.save();
    await recordAudit({
      actor: req.user!.id,
      action: 'task.update',
      entityType: 'care_task',
      entityId: task.id,
      summary: `Updated task "${task.title}"`,
    });
    broadcast({ type: 'care-task.changed', action: 'update', id: task.id });
    res.json({ task });
  }),
);

// Change status. The model enforces blocked -> reason and done -> completedAt.
careTasksRouter.patch(
  '/:id/status',
  requireRole('admin', 'staff'),
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const task = await findTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const { status, blockedReason } = parsed.data;
    task.status = status;
    task.blockedReason = status === 'blocked' ? blockedReason : undefined;
    await task.save();
    await recordAudit({
      actor: req.user!.id,
      action: 'task.status_change',
      entityType: 'care_task',
      entityId: task.id,
      summary: `Task "${task.title}" -> ${status}`,
    });
    broadcast({ type: 'care-task.changed', action: 'status', id: task.id });
    res.json({ task });
  }),
);

// Assign or unassign (assignedTo: id | null).
careTasksRouter.patch(
  '/:id/assign',
  requireRole('admin', 'staff'),
  asyncHandler(async (req, res) => {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const { assignedTo } = parsed.data;
    if (assignedTo && !(await User.exists({ _id: assignedTo }))) {
      res.status(400).json({ error: 'assignee_not_found' });
      return;
    }
    const task = await findTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    task.assignedTo = assignedTo ? new mongoose.Types.ObjectId(assignedTo) : undefined;
    await task.save();
    await recordAudit({
      actor: req.user!.id,
      action: 'task.assign',
      entityType: 'care_task',
      entityId: task.id,
      summary: assignedTo ? `Assigned task to ${assignedTo}` : 'Unassigned task',
    });
    broadcast({ type: 'care-task.changed', action: 'assign', id: task.id });
    res.json({ task });
  }),
);

// Delete a care task. Destructive, so admins only.
careTasksRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const task = await findTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    await task.deleteOne();
    await recordAudit({
      actor: req.user!.id,
      action: 'task.delete',
      entityType: 'care_task',
      entityId: task.id,
      summary: `Deleted task "${task.title}"`,
    });
    broadcast({ type: 'care-task.changed', action: 'delete', id: task.id });
    res.status(204).send();
  }),
);

// Return null for unknown or malformed ids so a bad id is a clean 404.
async function findTask(id: string | undefined) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return CareTask.findById(id);
}
