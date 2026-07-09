import type { Types } from 'mongoose';
import { AuditEvent, type AuditAction } from '../models/AuditEvent';

interface AuditInput {
  actor: string | Types.ObjectId;
  action: AuditAction;
  entityType: 'user' | 'patient' | 'care_task' | 'auth';
  entityId?: string | Types.ObjectId;
  summary: string;
  metadata?: Record<string, unknown>;
}

// Records an audit event. Never store secrets in metadata.
export async function recordAudit(input: AuditInput): Promise<void> {
  await AuditEvent.create(input);
}
