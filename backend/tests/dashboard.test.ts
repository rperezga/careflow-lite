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
let viewerAgent!: Agent;
let adminUserId!: string;
let staffUserId!: string;

beforeAll(async () => {
  await setupTestDb();
  await Promise.all([User.init(), Patient.init(), CareTask.init()]);

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

  adminAgent = await loginAs('admin@example.com', 'secret123');
  viewerAgent = await loginAs('viewer@example.com', 'secret123');
});

beforeEach(async () => {
  await Promise.all([Patient.deleteMany({}), CareTask.deleteMany({}), AuditEvent.deleteMany({})]);
});

afterAll(async () => {
  await teardownTestDb();
});

async function seedDataset() {
  await Patient.create([
    { firstName: 'A', lastName: 'A', memberId: 'D-1', riskLevel: 'high', status: 'active' },
    { firstName: 'B', lastName: 'B', memberId: 'D-2', riskLevel: 'high', status: 'active' },
    { firstName: 'C', lastName: 'C', memberId: 'D-3', riskLevel: 'low', status: 'inactive' },
  ]);
  const p = await Patient.findOne({ memberId: 'D-1' });
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await CareTask.create([
    {
      patient: p!.id,
      title: 't1',
      status: 'open',
      priority: 'urgent',
      dueDate: yesterday,
      createdBy: adminUserId,
    },
    {
      patient: p!.id,
      title: 't2',
      status: 'open',
      priority: 'low',
      assignedTo: staffUserId,
      createdBy: adminUserId,
    },
    { patient: p!.id, title: 't3', status: 'done', priority: 'medium', createdBy: adminUserId },
  ]);
  await AuditEvent.create([
    { actor: adminUserId, action: 'patient.create', entityType: 'patient', summary: 'seed a' },
    { actor: adminUserId, action: 'task.create', entityType: 'care_task', summary: 'seed b' },
  ]);
}

describe('dashboard API', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('lets any authenticated role read the dashboard, even with no data', async () => {
    const res = await viewerAgent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.patients.total).toBe(0);
    expect(res.body.patients.byRisk).toEqual({ low: 0, medium: 0, high: 0 });
    expect(res.body.tasks.total).toBe(0);
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
    expect(res.body.recentActivity).toHaveLength(0);
  });

  it('aggregates patients, tasks and recent activity correctly', async () => {
    await seedDataset();
    const res = await adminAgent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);

    expect(res.body.patients.total).toBe(3);
    expect(res.body.patients.byRisk).toEqual({ low: 1, medium: 0, high: 2 });
    expect(res.body.patients.byStatus).toEqual({ active: 2, inactive: 1 });

    expect(res.body.tasks.total).toBe(3);
    expect(res.body.tasks.byStatus.open).toBe(2);
    expect(res.body.tasks.byStatus.done).toBe(1);
    expect(res.body.tasks.byPriority.urgent).toBe(1);
    expect(res.body.tasks.byPriority.low).toBe(1);
    expect(res.body.tasks.overdue).toBe(1);
    expect(res.body.tasks.unassigned).toBe(1);

    expect(res.body.recentActivity).toHaveLength(2);
    expect(res.body.recentActivity[0].summary).toBeDefined();
    expect(res.body.recentActivity[0]._id).toBeUndefined();
  });
});
