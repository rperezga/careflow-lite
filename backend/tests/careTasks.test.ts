import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AuditEvent } from '../src/models/AuditEvent';
import { CareTask } from '../src/models/CareTask';
import { Patient } from '../src/models/Patient';
import { User } from '../src/models/User';
import { hashPassword } from '../src/services/auth.service';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

type Agent = Awaited<ReturnType<typeof loginAs>>;
let adminAgent!: Agent;
let staffAgent!: Agent;
let viewerAgent!: Agent;
let adminUserId!: string;
let staffUserId!: string;
let patientAId!: string;
let patientBId!: string;

async function seedTask(overrides: Record<string, unknown> = {}) {
  return CareTask.create({
    patient: patientAId,
    title: 'Follow up call',
    createdBy: adminUserId,
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  await Promise.all([User.init(), Patient.init(), CareTask.init()]);

  // Created once and kept for the whole file: stable ids + stateless JWT means
  // three logins total, well under the login rate limit (10 per window).
  const passwordHash = await hashPassword('secret123');
  await User.create([
    { name: 'Admin', email: 'admin@example.com', passwordHash, role: 'admin' },
    { name: 'Staff', email: 'staff@example.com', passwordHash, role: 'staff' },
    { name: 'Viewer', email: 'viewer@example.com', passwordHash, role: 'viewer' },
  ]);
  const admin = await User.findOne({ email: 'admin@example.com' });
  const staff = await User.findOne({ email: 'staff@example.com' });
  adminUserId = admin!.id;
  staffUserId = staff!.id;

  const pA = await Patient.create({ firstName: 'Pat', lastName: 'Alpha', memberId: 'DEMO-T1' });
  const pB = await Patient.create({ firstName: 'Pat', lastName: 'Bravo', memberId: 'DEMO-T2' });
  patientAId = pA.id;
  patientBId = pB.id;

  adminAgent = await loginAs('admin@example.com', 'secret123');
  staffAgent = await loginAs('staff@example.com', 'secret123');
  viewerAgent = await loginAs('viewer@example.com', 'secret123');
});

beforeEach(async () => {
  await Promise.all([CareTask.deleteMany({}), AuditEvent.deleteMany({})]);
});

afterAll(async () => {
  await teardownTestDb();
});

describe('care tasks API', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/care-tasks');
    expect(res.status).toBe(401);
  });

  it('lets any authenticated role list tasks (and hides _id)', async () => {
    await seedTask();
    const res = await viewerAgent.get('/api/care-tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.tasks[0].id).toBeDefined();
    expect(res.body.tasks[0]._id).toBeUndefined();
  });

  it('forbids viewers from creating tasks', async () => {
    const res = await viewerAgent
      .post('/api/care-tasks')
      .send({ patient: patientAId, title: 'New task' });
    expect(res.status).toBe(403);
  });

  it('lets staff create a task (createdBy set) and records an audit event', async () => {
    const res = await staffAgent.post('/api/care-tasks').send({
      patient: patientAId,
      title: 'Call patient',
      priority: 'high',
      category: 'follow_up',
    });
    expect(res.status).toBe(201);
    expect(res.body.task.priority).toBe('high');
    expect(res.body.task.patient).toBe(patientAId);
    expect(res.body.task.createdBy).toBe(staffUserId);
    const audits = await AuditEvent.find({ action: 'task.create' });
    expect(audits).toHaveLength(1);
  });

  it('rejects creating a task for a non-existent patient with 400', async () => {
    const res = await staffAgent
      .post('/api/care-tasks')
      .send({ patient: '507f1f77bcf86cd799439011', title: 'Ghost' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('patient_not_found');
  });

  it('validates input with 400', async () => {
    const res = await staffAgent.post('/api/care-tasks').send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('rejects status=blocked without a reason, accepts it with one', async () => {
    const bad = await staffAgent
      .post('/api/care-tasks')
      .send({ patient: patientAId, title: 'Blocked', status: 'blocked' });
    expect(bad.status).toBe(400);

    const ok = await staffAgent.post('/api/care-tasks').send({
      patient: patientAId,
      title: 'Blocked',
      status: 'blocked',
      blockedReason: 'waiting on records',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.task.status).toBe('blocked');
    expect(ok.body.task.blockedReason).toBe('waiting on records');
  });

  it('filters by status, priority and patient', async () => {
    await seedTask({ status: 'open', priority: 'low' });
    await seedTask({ status: 'in_progress', priority: 'urgent' });
    await seedTask({ patient: patientBId, title: 'For B', status: 'cancelled' });

    const open = await adminAgent.get('/api/care-tasks?status=open');
    expect(open.body.tasks).toHaveLength(1);

    const urgent = await adminAgent.get('/api/care-tasks?priority=urgent');
    expect(urgent.body.tasks).toHaveLength(1);

    const forB = await adminAgent.get(`/api/care-tasks?patient=${patientBId}`);
    expect(forB.body.tasks).toHaveLength(1);
    expect(forB.body.tasks[0].title).toBe('For B');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 3; i++) await seedTask({ title: `Task ${i}` });
    const res = await adminAgent.get('/api/care-tasks?limit=2&page=1');
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(2);
  });

  it('gets a task by id and 404s for unknown or malformed ids', async () => {
    const t = await seedTask();
    const ok = await viewerAgent.get(`/api/care-tasks/${t.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.task.id).toBe(t.id);

    const missing = await viewerAgent.get('/api/care-tasks/507f1f77bcf86cd799439011');
    expect(missing.status).toBe(404);

    const malformed = await viewerAgent.get('/api/care-tasks/not-a-valid-id');
    expect(malformed.status).toBe(404);
  });

  it('updates descriptive fields without touching status', async () => {
    const t = await seedTask({ status: 'open', priority: 'low' });
    const res = await staffAgent
      .patch(`/api/care-tasks/${t.id}`)
      .send({ priority: 'urgent', title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.task.priority).toBe('urgent');
    expect(res.body.task.title).toBe('Renamed');
    expect(res.body.task.status).toBe('open');
  });

  it('changes status, setting completedAt on done and clearing it after', async () => {
    const t = await seedTask({ status: 'open' });

    const done = await staffAgent.patch(`/api/care-tasks/${t.id}/status`).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.task.status).toBe('done');
    expect(done.body.task.completedAt).toBeTruthy();

    const reopened = await staffAgent
      .patch(`/api/care-tasks/${t.id}/status`)
      .send({ status: 'in_progress' });
    expect(reopened.body.task.completedAt).toBeUndefined();

    const audits = await AuditEvent.find({ action: 'task.status_change' });
    expect(audits).toHaveLength(2);
  });

  it('rejects blocking without a reason via the status endpoint', async () => {
    const t = await seedTask({ status: 'open' });
    const res = await staffAgent
      .patch(`/api/care-tasks/${t.id}/status`)
      .send({ status: 'blocked' });
    expect(res.status).toBe(400);
  });

  it('assigns, rejects a ghost assignee, and unassigns', async () => {
    const t = await seedTask();

    const assigned = await staffAgent
      .patch(`/api/care-tasks/${t.id}/assign`)
      .send({ assignedTo: staffUserId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.task.assignedTo).toBe(staffUserId);

    const ghost = await staffAgent
      .patch(`/api/care-tasks/${t.id}/assign`)
      .send({ assignedTo: '507f1f77bcf86cd799439011' });
    expect(ghost.status).toBe(400);
    expect(ghost.body.error).toBe('assignee_not_found');

    const unassigned = await staffAgent
      .patch(`/api/care-tasks/${t.id}/assign`)
      .send({ assignedTo: null });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.task.assignedTo).toBeUndefined();

    const audits = await AuditEvent.find({ action: 'task.assign' });
    expect(audits).toHaveLength(2);
  });

  it('only lets admins delete a task (and audits it)', async () => {
    const t = await seedTask();

    const forbidden = await staffAgent.delete(`/api/care-tasks/${t.id}`);
    expect(forbidden.status).toBe(403);

    const ok = await adminAgent.delete(`/api/care-tasks/${t.id}`);
    expect(ok.status).toBe(204);
    expect(await CareTask.findById(t.id)).toBeNull();
    const audits = await AuditEvent.find({ action: 'task.delete' });
    expect(audits).toHaveLength(1);
  });
});
