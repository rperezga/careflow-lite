import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';

// Build the Express app without listening, so tests can import it directly.
export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRouter);
  app.use(errorHandler);
  return app;
}
