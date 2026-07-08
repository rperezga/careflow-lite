import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service';

export const AUTH_COOKIE = 'careflow_token';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
