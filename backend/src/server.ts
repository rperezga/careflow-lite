import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDb } from './db/mongoose';
import { attachRealtime } from './realtime/hub';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  await connectDb();
  const app = createApp();

  // Own the HTTP server so the realtime hub can share the same port.
  const server = createServer(app);
  attachRealtime(server);

  server.listen(env.PORT, () => {
    logger.info(`careflow-lite backend listening on port ${env.PORT}`);
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
