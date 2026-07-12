import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { AUTH_COOKIE, requireAuth } from '../middleware/requireAuth';
import { User } from '../models/User';
import { signToken, verifyPassword } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const user = await User.findOne({ email });
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    res.cookie(AUTH_COOKIE, token, cookieOptions);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }),
);

authRouter.post('/logout', requireAuth, (_req, res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }),
);
