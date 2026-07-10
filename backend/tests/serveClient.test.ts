import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { serveClient } from '../src/middleware/serveClient';

const dir = mkdtempSync(path.join(tmpdir(), 'cf-client-'));
writeFileSync(
  path.join(dir, 'index.html'),
  '<!doctype html><title>Careflow</title><div id="root"></div>',
);

function buildApp() {
  const app = express();
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  serveClient(app, dir);
  return app;
}

describe('serveClient (production static + SPA fallback)', () => {
  it('serves index.html for a client-side route', async () => {
    const res = await request(buildApp()).get('/patients');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="root"');
  });

  it('still serves real API routes', async () => {
    const res = await request(buildApp()).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('does not return index.html for unknown API routes', async () => {
    const res = await request(buildApp()).get('/api/nope');
    expect(res.status).toBe(404);
  });
});
