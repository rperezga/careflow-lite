import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { User } from '../models/User';
import { hashPassword } from '../services/auth.service';
import { recordAudit } from '../services/audit.service';
import { createUserSchema, updateUserSchema } from '../validators/user.schema';

export const usersRouter = Router();

// Every route here is admin-only.
usersRouter.use(requireAuth, requireRole('admin'));

usersRouter.get('/', async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.role === 'string') filter.role = req.query.role;
  if (typeof req.query.active === 'string') filter.active = req.query.active === 'true';
  const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 });
  res.json({ users });
});

usersRouter.post('/', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    return;
  }
  const { name, email, password, role } = parsed.data;
  if (await User.findOne({ email: email.toLowerCase() })) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }
  const user = await User.create({ name, email, passwordHash: await hashPassword(password), role });
  await recordAudit({
    actor: req.user!.id,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    summary: `Created user ${user.email}`,
  });
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active },
  });
});

usersRouter.patch('/:id', async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const wasActive = user.active;
  Object.assign(user, parsed.data);
  await user.save();
  const action = parsed.data.active === false && wasActive ? 'user.deactivate' : 'user.update';
  await recordAudit({
    actor: req.user!.id,
    action,
    entityType: 'user',
    entityId: user.id,
    summary: `Updated user ${user.email}`,
  });
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active },
  });
});
