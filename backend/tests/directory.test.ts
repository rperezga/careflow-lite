import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { hashPassword } from '../src/services/auth.service';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

beforeAll(async () => {
  await setupTestDb();
  await User.init();
  const passwordHash = await hashPassword('secret123');
  await User.create([
    { name: 'Admin', email: 'admin@example.com', passwordHash, role: 'admin' },
    { name: 'Viewer', email: 'viewer@example.com', passwordHash, role: 'viewer' },
    { name: 'Inactive', email: 'inactive@example.com', passwordHash, role: 'staff', active: false },
  ]);
});

afterAll(async () => {
  await teardownTestDb();
});

describe('directory API', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/directory/users');
    expect(res.status).toBe(401);
  });

  it('lets any authenticated role list active users without secrets', async () => {
    const agent = await loginAs('viewer@example.com', 'secret123');
    const res = await agent.get('/api/directory/users');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2); // inactive user excluded
    expect(res.body.users[0].passwordHash).toBeUndefined();
    expect(res.body.users.map((u: { name: string }) => u.name)).toContain('Admin');
  });
});
