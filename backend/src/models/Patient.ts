import { Schema, model } from 'mongoose';

export const PATIENT_STATUS = ['active', 'inactive'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high'] as const;

const patientSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true, index: true },
    dateOfBirth: { type: String }, // synthetic YYYY-MM-DD
    memberId: { type: String, required: true, unique: true }, // synthetic, e.g. DEMO-10023
    phone: { type: String },
    email: { type: String },
    status: { type: String, enum: PATIENT_STATUS, default: 'active', index: true },
    riskLevel: { type: String, enum: RISK_LEVELS, default: 'low', index: true },
    primaryCareManager: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    notes: { type: String },
  },
  { timestamps: true },
);

// Expose a clean `id` virtual and drop Mongo internals (_id, __v) from API JSON.
patientSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    const { _id, ...rest } = ret;
    return rest;
  },
});

export const Patient = model('Patient', patientSchema);
