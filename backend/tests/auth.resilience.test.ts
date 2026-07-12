import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('auth routes resilience (regression)', () => {
  // Production incident: a misconfigured MONGODB_URI made every query fail with
  // "Command find requires authentication". Because the login handler was not
  // wrapped, Express 4 never produced a response and the request hung until
  // Cloudflare returned a 524. It must fail fast and loudly instead.
  it('answers 500 (and never hangs) when the database rejects the login query', async () => {
    // Reject lazily (on call), so the promise is awaited immediately by the route
    // and never sits around as an unhandled rejection.
    vi.spyOn(User, 'findOne').mockImplementation((() =>
      Promise.reject(new Error('Command find requires authentication'))) as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'demo-password' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
  });
});
