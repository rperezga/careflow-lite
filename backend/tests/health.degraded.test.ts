import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

// The database cannot serve an authenticated command.
vi.mock('../src/db/health', () => ({
  checkDbHealth: vi.fn(() => Promise.resolve('unreachable')),
}));

describe('GET /health when the database is unreachable', () => {
  it('reports 503 instead of a misleading ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe('unreachable');
  });
});
