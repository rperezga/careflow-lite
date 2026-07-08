import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { requireRole } from '../src/middleware/requireRole';
import type { Role } from '../src/models/User';

function invoke(user: { role: Role } | undefined, allowed: Role[]) {
  const req = { user } as unknown as Request;
  let statusCode: number | undefined;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };
  requireRole(...allowed)(req, res, next);
  return { statusCode, nextCalled };
}

describe('requireRole', () => {
  it('calls next when the role is allowed', () => {
    const r = invoke({ role: 'admin' }, ['admin']);
    expect(r.nextCalled).toBe(true);
    expect(r.statusCode).toBeUndefined();
  });

  it('responds 403 when the role is not allowed', () => {
    const r = invoke({ role: 'viewer' }, ['admin', 'staff']);
    expect(r.nextCalled).toBe(false);
    expect(r.statusCode).toBe(403);
  });

  it('responds 401 when there is no user', () => {
    const r = invoke(undefined, ['admin']);
    expect(r.nextCalled).toBe(false);
    expect(r.statusCode).toBe(401);
  });
});
