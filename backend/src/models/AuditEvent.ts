import { Schema, model } from 'mongoose';

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.logout',
  'patient.create',
  'patient.update',
  'patient.delete',
  'task.create',
  'task.update',
  'task.status_change',
  'task.assign',
  'task.delete',
  'user.create',
  'user.update',
  'user.deactivate',
] as const;
export const AUDIT_ENTITY_TYPES = ['user', 'patient', 'care_task', 'auth'] as const;

const auditEventSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    entityType: { type: String, enum: AUDIT_ENTITY_TYPES, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    summary: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed }, // sanitized, never secrets
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditEvent = model('AuditEvent', auditEventSchema);
