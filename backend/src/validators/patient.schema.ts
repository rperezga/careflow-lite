import { z } from 'zod';
import { PATIENT_STATUS, RISK_LEVELS } from '../models/Patient';

// A 24-char hex Mongo ObjectId, validated before it ever reaches the DB.
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'invalid_object_id');
// Synthetic date of birth as YYYY-MM-DD (no real patient data).
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');

export const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  memberId: z.string().min(1),
  dateOfBirth: isoDate.optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  status: z.enum(PATIENT_STATUS).default('active'),
  riskLevel: z.enum(RISK_LEVELS).default('low'),
  primaryCareManager: objectId.optional(),
  notes: z.string().optional(),
});

// memberId is intentionally omitted: it is the patient's immutable identity.
export const updatePatientSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: isoDate,
    phone: z.string().min(1),
    email: z.string().email(),
    status: z.enum(PATIENT_STATUS),
    riskLevel: z.enum(RISK_LEVELS),
    primaryCareManager: objectId,
    notes: z.string(),
  })
  .partial();

export const listPatientsQuerySchema = z.object({
  status: z.enum(PATIENT_STATUS).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  primaryCareManager: objectId.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
