import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AuditEvent } from '../src/models/AuditEvent';
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

async function seedPatient(overrides: Record<string, unknown> = {}) {
  return Patient.create({
    firstName: 'Ana',
    lastName: 'Gomez',
    memberId: `DEMO-${Math.random().toString().slice(2, 7)}`,
    status: 'active',
    riskLevel: 'low',
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  await User.init();
  await Patient.init();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Patient.deleteMany({}), AuditEvent.deleteMany({})]);
  const passwordHash = await hashPassword('secret123');
  await User.create([
    { name: 'Admin', email: 'admin@example.com', passwordHash, role: 'admin' },
    { name: 'Staff', email: 'staff@example.com', passwordHash, role: 'staff' },
    { name: 'Viewer', email: 'viewer@example.com', passwordHash, role: 'viewer' },
  ]);
});

afterAll(async () => {
  await teardownTestDb();
});

describe('patients API', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('lets any authenticated role list patients (and hides _id)', async () => {
    await seedPatient();
    const agent = await loginAs('viewer@example.com', 'secret123');
    const res = await agent.get('/api/patients');
    expect(res.status).toBe(200);
    expect(res.body.patients).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.patients[0].id).toBeDefined();
    expect(res.body.patients[0]._id).toBeUndefined();
    expect(res.body.patients[0].__v).toBeUndefined();
  });

  it('forbids viewers from creating patients', async () => {
    const agent = await loginAs('viewer@example.com', 'secret123');
    const res = await agent
      .post('/api/patients')
      .send({ firstName: 'New', lastName: 'Patient', memberId: 'DEMO-90001' });
    expect(res.status).toBe(403);
  });

  it('lets staff create a patient and records an audit event', async () => {
    const agent = await loginAs('staff@example.com', 'secret123');
    const res = await agent
      .post('/api/patients')
      .send({ firstName: 'Luis', lastName: 'Perez', memberId: 'DEMO-90002', riskLevel: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.patient.riskLevel).toBe('high');
    expect(res.body.patient.memberId).toBe('DEMO-90002');
    const audits = await AuditEvent.find({ action: 'patient.create' });
    expect(audits).toHaveLength(1);
  });

  it('rejects a duplicate memberId with 409', async () => {
    await seedPatient({ memberId: 'DEMO-90003' });
    const agent = await loginAs('staff@example.com', 'secret123');
    const res = await agent
      .post('/api/patients')
      .send({ firstName: 'Dup', lastName: 'Licate', memberId: 'DEMO-90003' });
    expect(res.status).toBe(409);
  });

  it('validates input with 400', async () => {
    const agent = await loginAs('staff@example.com', 'secret123');
    const res = await agent.post('/api/patients').send({ firstName: '', lastName: '' });
    expect(res.status).toBe(400);
  });

  it('filters by riskLevel and searches by name', async () => {
    await seedPatient({
      firstName: 'Marta',
      lastName: 'Ramirez',
      memberId: 'DEMO-90010',
      riskLevel: 'high',
    });
    await seedPatient({
      firstName: 'Carlos',
      lastName: 'Ortiz',
      memberId: 'DEMO-90011',
      riskLevel: 'low',
    });
    const agent = await loginAs('admin@example.com', 'secret123');

    const byRisk = await agent.get('/api/patients?riskLevel=high');
    expect(byRisk.body.patients).toHaveLength(1);
    expect(byRisk.body.patients[0].firstName).toBe('Marta');

    const bySearch = await agent.get('/api/patients?search=ortiz');
    expect(bySearch.body.patients).toHaveLength(1);
    expect(bySearch.body.patients[0].lastName).toBe('Ortiz');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 3; i++) await seedPatient({ memberId: `DEMO-9002${i}` });
    const agent = await loginAs('admin@example.com', 'secret123');
    const res = await agent.get('/api/patients?limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body.patients).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(2);
  });

  it('gets a patient by id and 404s for unknown or malformed ids', async () => {
    const p = await seedPatient();
    const agent = await loginAs('viewer@example.com', 'secret123');

    const ok = await agent.get(`/api/patients/${p.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.patient.id).toBe(p.id);

    const missing = await agent.get('/api/patients/507f1f77bcf86cd799439011');
    expect(missing.status).toBe(404);

    const malformed = await agent.get('/api/patients/not-a-valid-id');
    expect(malformed.status).toBe(404);
  });

  it('lets staff update a patient', async () => {
    const p = await seedPatient({ riskLevel: 'low' });
    const agent = await loginAs('staff@example.com', 'secret123');
    const res = await agent
      .patch(`/api/patients/${p.id}`)
      .send({ riskLevel: 'medium', status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.patient.riskLevel).toBe('medium');
    expect(res.body.patient.status).toBe('inactive');
  });

  it('only lets admins delete a patient (and audits it)', async () => {
    const p = await seedPatient();

    const staff = await loginAs('staff@example.com', 'secret123');
    const forbidden = await staff.delete(`/api/patients/${p.id}`);
    expect(forbidden.status).toBe(403);

    const admin = await loginAs('admin@example.com', 'secret123');
    const ok = await admin.delete(`/api/patients/${p.id}`);
    expect(ok.status).toBe(204);
    expect(await Patient.findById(p.id)).toBeNull();
    const audits = await AuditEvent.find({ action: 'patient.delete' });
    expect(audits).toHaveLength(1);
  });
});
