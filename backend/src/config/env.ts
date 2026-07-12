import { z } from 'zod';

// Validate environment at startup: fail fast if something critical is wrong.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Bind to the loopback interface by default. Without an explicit host, Node listens on every
  // interface — including a globally routable IPv6 address, which would put the API on the public
  // internet and bypass the tunnel that fronts it. Deployments that genuinely need a public bind
  // (a container, a PaaS) can opt in with HOST=0.0.0.0.
  HOST: z.string().default('127.0.0.1'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/careflow_lite'),
  JWT_SECRET: z.string().min(1).default('change-me-in-prod'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
