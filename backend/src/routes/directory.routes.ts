import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

export const directoryRouter = Router();

// A minimal, read-only directory of active users for assignment pickers and
// name resolution. Any authenticated role may read it (unlike the admin-only
// user-management API), and it never exposes sensitive fields.
directoryRouter.use(requireAuth);

directoryRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await User.find({ active: true }).select('name email role').sort({ name: 1 });
    res.json({
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    });
  }),
);
