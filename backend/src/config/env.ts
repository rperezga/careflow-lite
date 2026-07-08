import { z } from 'zod';

// Validate environment at startup: fail fast if something critical is wrong.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/careflow_lite'),
  JWT_SECRET: z.string().min(1).default('change-me-in-prod'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
