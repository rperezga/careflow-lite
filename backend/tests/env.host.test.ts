import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Regression guard. `server.listen(PORT)` with no host makes Node listen on EVERY interface,
// including a globally routable IPv6 address. On the production box that put the API on the public
// internet, reachable without ever passing through the tunnel that is supposed to front it.
// The default must stay on loopback; exposing the process has to be a deliberate opt-in.
describe('env.HOST', () => {
  afterEach(() => {
    delete process.env.HOST;
    vi.resetModules();
  });

  async function loadEnv(): Promise<{ HOST: string }> {
    vi.resetModules();
    const { env } = await import('../src/config/env');
    return env;
  }

  it('defaults to loopback when HOST is not set', async () => {
    delete process.env.HOST;
    const env = await loadEnv();
    expect(env.HOST).toBe('127.0.0.1');
  });

  it('binds a real server to loopback only, using the default', async () => {
    delete process.env.HOST;
    const env = await loadEnv();

    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, env.HOST, resolve));
    const address = server.address() as AddressInfo;

    expect(address.address).toBe('127.0.0.1');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('can still be opened up explicitly (containers, PaaS)', async () => {
    process.env.HOST = '0.0.0.0';
    const env = await loadEnv();
    expect(env.HOST).toBe('0.0.0.0');
  });
});
