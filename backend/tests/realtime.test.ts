import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AUTH_COOKIE } from '../src/middleware/requireAuth';
import { attachRealtime, broadcast, resetClients } from '../src/realtime/hub';
import { signToken } from '../src/services/auth.service';

let server: Server;
let url: string;

const token = signToken({ sub: 'u1', role: 'admin', email: 'admin@example.com' });
const authHeaders = { Cookie: `${AUTH_COOKIE}=${token}` };

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

beforeAll(async () => {
  server = createServer(createApp());
  attachRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const { port } = server.address() as AddressInfo;
  url = `ws://127.0.0.1:${port}/ws`;
});

afterAll(async () => {
  resetClients();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('realtime hub', () => {
  it('rejects an unauthenticated upgrade', async () => {
    const ws = new WebSocket(url);
    const err = await new Promise<Error>((resolve) => ws.once('error', resolve));
    expect(err.message).toMatch(/401/);
  });

  it('accepts an authenticated client and delivers broadcast events', async () => {
    const ws = new WebSocket(url, { headers: authHeaders });
    const hello = nextMessage(ws);
    await new Promise<void>((resolve) => ws.once('open', () => resolve()));
    expect((await hello).type).toBe('connected');

    const event = nextMessage(ws);
    broadcast({ type: 'care-task.changed', action: 'status', id: 't1' });
    const payload = await event;
    expect(payload.type).toBe('care-task.changed');
    expect(payload.action).toBe('status');
    expect(payload.id).toBe('t1');

    ws.close();
  });
});
