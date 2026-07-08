import { Router } from 'express';

const VERSION = '0.1.0';

export const healthRouter = Router();

// GET /health — technical healthcheck, not a business feature.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'careflow-lite', version: VERSION });
});
