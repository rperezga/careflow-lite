import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('GET /health', () => {
  it('returns ok with service, version and a healthy database', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('careflow-lite');
    expect(res.body).toHaveProperty('version');
    expect(res.body.db).toBe('ok');
  });
});
