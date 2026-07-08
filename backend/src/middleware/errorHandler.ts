import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Central error handler: JSON responses, no stack trace in production.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err }, 'Unhandled error');
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({
    error: 'internal_error',
    message: env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
  });
}
