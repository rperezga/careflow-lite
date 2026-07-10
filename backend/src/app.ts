import cookieParser from 'cookie-parser';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { serveClient } from './middleware/serveClient';
import { authRouter } from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import { careTasksRouter } from './routes/careTasks.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { directoryRouter } from './routes/directory.routes';
import { patientsRouter } from './routes/patients.routes';
import { usersRouter } from './routes/users.routes';

// Build the Express app without listening, so tests can import it directly.
export function createApp() {
  const app = express();
  // Behind the Cloudflare tunnel in production, trust the first proxy so
  // req.ip (and the login rate-limiter) sees the real client, not the tunnel.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/patients', patientsRouter);
  app.use('/api/care-tasks', careTasksRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/directory', directoryRouter);
  // In production, serve the built frontend from this same server.
  if (env.NODE_ENV === 'production') serveClient(app);
  app.use(errorHandler);
  return app;
}
