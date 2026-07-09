import { Router } from 'express';
import type { PipelineStage } from 'mongoose';
import { CareTask, TASK_PRIORITIES, TASK_STATUSES } from '../models/CareTask';
import { AuditEvent } from '../models/AuditEvent';
import { PATIENT_STATUS, Patient, RISK_LEVELS } from '../models/Patient';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboardRouter = Router();

// The dashboard is read-only and visible to every authenticated role.
dashboardRouter.use(requireAuth);

// One aggregated snapshot for the dashboard. Each collection is summarised in a
// single $facet aggregation (one round-trip) instead of many count queries.
dashboardRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const now = new Date();

    const patientFacet: PipelineStage[] = [
      {
        $facet: {
          total: [{ $count: 'n' }],
          byRisk: [{ $group: { _id: '$riskLevel', n: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
        },
      },
    ];

    const taskFacet: PipelineStage[] = [
      {
        $facet: {
          total: [{ $count: 'n' }],
          byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: '$priority', n: { $sum: 1 } } }],
          overdue: [
            { $match: { dueDate: { $lt: now }, status: { $nin: ['done', 'cancelled'] } } },
            { $count: 'n' },
          ],
          unassigned: [
            { $match: { assignedTo: null, status: { $nin: ['done', 'cancelled'] } } },
            { $count: 'n' },
          ],
        },
      },
    ];

    const activityPipeline: PipelineStage[] = [
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          action: 1,
          entityType: 1,
          entityId: 1,
          summary: 1,
          actor: 1,
          createdAt: 1,
        },
      },
    ];

    const [[patientAgg], [taskAgg], recentActivity] = await Promise.all([
      Patient.aggregate(patientFacet),
      CareTask.aggregate(taskFacet),
      AuditEvent.aggregate(activityPipeline),
    ]);

    res.json({
      generatedAt: now,
      patients: {
        total: firstCount(patientAgg?.total),
        byRisk: bucketize(patientAgg?.byRisk, RISK_LEVELS),
        byStatus: bucketize(patientAgg?.byStatus, PATIENT_STATUS),
      },
      tasks: {
        total: firstCount(taskAgg?.total),
        byStatus: bucketize(taskAgg?.byStatus, TASK_STATUSES),
        byPriority: bucketize(taskAgg?.byPriority, TASK_PRIORITIES),
        overdue: firstCount(taskAgg?.overdue),
        unassigned: firstCount(taskAgg?.unassigned),
      },
      recentActivity,
    });
  }),
);

// Turn a [{ _id, n }] group result into a fully-keyed object with zeros filled in.
function bucketize(
  rows: Array<{ _id: string; n: number }> | undefined,
  keys: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = 0;
  for (const r of rows ?? []) {
    if (r && typeof r._id === 'string') out[r._id] = r.n;
  }
  return out;
}

// A $count sub-pipeline yields [] or [{ n }].
function firstCount(rows: Array<{ n: number }> | undefined): number {
  return rows?.[0]?.n ?? 0;
}
