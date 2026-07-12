import mongoose from 'mongoose';

export type DbHealth = 'ok' | 'unreachable';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('db_health_timeout')), ms);
    timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('db_error'));
      },
    );
  });
}

/**
 * Real readiness check.
 *
 * We deliberately issue `dbStats`, which REQUIRES authentication, instead of
 * `ping`, which MongoDB answers even to an unauthenticated client. A misconfigured
 * URI (no credentials) still completes the handshake, so a ping-based check would
 * report "ok" while every real query fails with "requires authentication" — that
 * exact false positive hid a production outage. If the database cannot serve an
 * authenticated command, the service is not ready and must say so.
 */
export async function checkDbHealth(timeoutMs = 2000): Promise<DbHealth> {
  try {
    const db = mongoose.connection.db;
    if (!db || mongoose.connection.readyState !== 1) return 'unreachable';
    await withTimeout(db.command({ dbStats: 1 }), timeoutMs);
    return 'ok';
  } catch {
    return 'unreachable';
  }
}
