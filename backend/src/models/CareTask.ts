import { Schema, model } from 'mongoose';

export const TASK_CATEGORIES = [
  'follow_up',
  'documentation',
  'access_issue',
  'medication',
  'appointment',
  'billing',
  'other',
] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'done', 'cancelled'] as const;

const careTaskSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    category: { type: String, enum: TASK_CATEGORIES, default: 'other', index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'open', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, index: true },
    blockedReason: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

// Business rules
careTaskSchema.pre('validate', function (next) {
  if (this.status === 'blocked' && !this.blockedReason) {
    this.invalidate('blockedReason', 'blockedReason is required when status is blocked');
  }
  next();
});

careTaskSchema.pre('save', function (next) {
  if (this.status === 'done' && !this.completedAt) {
    this.completedAt = new Date();
  } else if (this.status !== 'done') {
    this.completedAt = undefined;
  }
  next();
});

// Expose a clean `id` and drop Mongo internals (_id, __v) from API JSON.
careTaskSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    const { _id, ...rest } = ret;
    return rest;
  },
});

export const CareTask = model('CareTask', careTaskSchema);
