import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { Patient } from '../models/Patient';
import { recordAudit } from '../services/audit.service';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from '../validators/patient.schema';

export const patientsRouter = Router();

// Every patient route requires a valid session.
patientsRouter.use(requireAuth);

// List patients with optional filters and pagination.
// Any authenticated role (admin, staff, viewer) may read.
patientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listPatientsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const { status, riskLevel, primaryCareManager, search, page, limit } = parsed.data;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (primaryCareManager) filter.primaryCareManager = primaryCareManager;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { memberId: rx }];
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Patient.countDocuments(filter),
    ]);

    res.json({ patients, total, page, limit });
  }),
);

// Get one patient by id.
patientsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const patient = await findPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ patient });
  }),
);

// Create a patient. Staff and admins manage patients; viewers cannot.
patientsRouter.post(
  '/',
  requireRole('admin', 'staff'),
  asyncHandler(async (req, res) => {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    if (await Patient.findOne({ memberId: data.memberId })) {
      res.status(409).json({ error: 'member_id_taken' });
      return;
    }
    const patient = await Patient.create(data);
    await recordAudit({
      actor: req.user!.id,
      action: 'patient.create',
      entityType: 'patient',
      entityId: patient.id,
      summary: `Created patient ${patient.memberId}`,
    });
    res.status(201).json({ patient });
  }),
);

// Update a patient. Staff and admins only.
patientsRouter.patch(
  '/:id',
  requireRole('admin', 'staff'),
  asyncHandler(async (req, res) => {
    const parsed = updatePatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
      return;
    }
    const patient = await findPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    Object.assign(patient, parsed.data);
    await patient.save();
    await recordAudit({
      actor: req.user!.id,
      action: 'patient.update',
      entityType: 'patient',
      entityId: patient.id,
      summary: `Updated patient ${patient.memberId}`,
    });
    res.json({ patient });
  }),
);

// Delete a patient. Destructive, so admins only.
patientsRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const patient = await findPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    await patient.deleteOne();
    await recordAudit({
      actor: req.user!.id,
      action: 'patient.delete',
      entityType: 'patient',
      entityId: patient.id,
      summary: `Deleted patient ${patient.memberId}`,
    });
    res.status(204).send();
  }),
);

// Return null for unknown or malformed ids so a bad id is a clean 404,
// not a Mongoose CastError bubbling up as a 500.
async function findPatient(id: string | undefined) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return Patient.findById(id);
}

// Escape user input before using it in a RegExp (avoids regex injection).
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
