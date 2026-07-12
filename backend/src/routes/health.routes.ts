import { Router } from 'express';
import { checkDbHealth } from '../db/health';
import { asyncHandler } from '../utils/asyncHandler';

const VERSION = '0.1.0';

export const healthRouter = Router();

// GET /health — liveness AND readiness. It returns 503 when the database cannot
// serve an authenticated command, so a 200 actually means the app can do its job.
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = await checkDbHealth();
    const healthy = db === 'ok';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      service: 'careflow-lite',
      version: VERSION,
      db,
    });
  }),
);
