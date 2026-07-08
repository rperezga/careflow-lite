import { createApp } from './app';
import { connectDb } from './db/mongoose';
import { env } from './config/env';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`careflow-lite backend listening on port ${env.PORT}`);
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
