import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { AUTH_COOKIE } from '../middleware/requireAuth';
import { verifyToken } from '../services/auth.service';
import { logger } from '../utils/logger';

export interface RealtimeEvent {
  type: 'care-task.changed' | 'patient.changed';
  action: string;
  id?: string;
}

const clients = new Set<WebSocket>();

// Read one cookie out of a raw Cookie header.
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

/**
 * Attach the realtime hub to the HTTP server.
 *
 * The upgrade is authenticated with the SAME HttpOnly session cookie as the REST
 * API, so an unauthenticated client is rejected before a socket is ever opened.
 */
export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    const token = readCookie(req.headers.cookie, AUTH_COOKIE);
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    try {
      verifyToken(token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.add(ws);
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
      ws.send(JSON.stringify({ type: 'connected' }));
    });
  });

  logger.info('Realtime hub attached on /ws');
}

/** Push an event to every connected (authenticated) client. */
export function broadcast(event: RealtimeEvent): void {
  const payload = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

/** Test helper: forget all tracked clients. */
export function resetClients(): void {
  clients.clear();
}
