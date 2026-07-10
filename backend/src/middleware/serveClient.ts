import path from 'node:path';
import express from 'express';
import type { Express } from 'express';

// In production the backend serves the built frontend from the same origin
// (no CORS). The frontend builds to frontend/dist; from the compiled
// backend/dist/middleware that is three levels up.
const DEFAULT_CLIENT_DIR = path.resolve(__dirname, '../../../frontend/dist');

export function serveClient(app: Express, clientDir: string = DEFAULT_CLIENT_DIR): void {
  app.use(express.static(clientDir));

  // SPA fallback: any GET that is not an API or health route returns index.html
  // so client-side routing (e.g. /patients, /care-tasks) works on refresh.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      next();
      return;
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}
