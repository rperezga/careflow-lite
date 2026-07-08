import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDb, disconnectDb } from '../src/db/mongoose';
import { User } from '../src/models/User';
import { hashPassword } from '../src/services/auth.service';

let mongo: MongoMemoryServer | undefined;
const app = createApp();

beforeAll(async () => {
  let uri = process.env.MONGO_TEST_URI;
  if (!uri) {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri();
  }
  await connectDb(uri);
  await User.init();
  await User.create({
    name: 'Admin',
    email: 'admin@example.com',
    passwordHash: await hashPassword('secret123'),
    role: 'admin',
  });
});

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe('POST /api/auth/login', () => {
  it('rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs in, returns the user and sets an HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('careflow_token');
    expect(cookie).toContain('HttpOnly');
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'secret123' });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@example.com');
  });
});
