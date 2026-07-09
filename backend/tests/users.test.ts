import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDb, disconnectDb } from '../src/db/mongoose';
import { User } from '../src/models/User';
import { hashPassword } from '../src/services/auth.service';

let mongo: MongoMemoryServer | undefined;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

beforeAll(async () => {
  let uri = process.env.MONGO_TEST_URI;
  if (!uri) {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri();
  }
  await connectDb(uri);
  await User.init();
});

beforeEach(async () => {
  await User.deleteMany({});
  const passwordHash = await hashPassword('secret123');
  await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash, role: 'admin' });
  await User.create({ name: 'Viewer', email: 'viewer@example.com', passwordHash, role: 'viewer' });
});

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe('users API (admin only)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admins', async () => {
    const agent = await loginAs('viewer@example.com', 'secret123');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(403);
  });

  it('lets an admin list users without password hashes', async () => {
    const agent = await loginAs('admin@example.com', 'secret123');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0].passwordHash).toBeUndefined();
  });

  it('lets an admin create a user', async () => {
    const agent = await loginAs('admin@example.com', 'secret123');
    const res = await agent
      .post('/api/users')
      .send({ name: 'Staff', email: 'staff@example.com', password: 'password1', role: 'staff' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('staff');
  });

  it('rejects a duplicate email with 409', async () => {
    const agent = await loginAs('admin@example.com', 'secret123');
    const res = await agent
      .post('/api/users')
      .send({ name: 'Dup', email: 'admin@example.com', password: 'password1' });
    expect(res.status).toBe(409);
  });

  it('validates input with 400', async () => {
    const agent = await loginAs('admin@example.com', 'secret123');
    const res = await agent.post('/api/users').send({ name: '', email: 'bad', password: '123' });
    expect(res.status).toBe(400);
  });

  it('lets an admin update role and active status', async () => {
    const agent = await loginAs('admin@example.com', 'secret123');
    const viewer = await User.findOne({ email: 'viewer@example.com' });
    const res = await agent
      .patch(`/api/users/${viewer!.id}`)
      .send({ role: 'staff', active: false });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('staff');
    expect(res.body.user.active).toBe(false);
  });
});
