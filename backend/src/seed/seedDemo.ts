import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../db/mongoose';
import { AuditEvent } from '../models/AuditEvent';
import { CareTask } from '../models/CareTask';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Seeds synthetic demo data only. No real patient data (PHI).
export async function seedDemo(): Promise<void> {
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    CareTask.deleteMany({}),
    AuditEvent.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash('demo-password', 10);
  const users = await User.create([
    { name: 'Admin Demo', email: 'admin@example.com', passwordHash, role: 'admin' },
    { name: 'Staff Demo', email: 'staff@example.com', passwordHash, role: 'staff' },
    { name: 'Viewer Demo', email: 'viewer@example.com', passwordHash, role: 'viewer' },
  ]);
  const admin = users[0]!;
  const staff = users[1]!;

  const patients = await Patient.create([
    {
      firstName: 'Ada',
      lastName: 'Nguyen',
      memberId: 'DEMO-10001',
      riskLevel: 'high',
      primaryCareManager: staff._id,
    },
    {
      firstName: 'Ben',
      lastName: 'Carter',
      memberId: 'DEMO-10002',
      riskLevel: 'medium',
      primaryCareManager: staff._id,
    },
    { firstName: 'Cira', lastName: 'Lopez', memberId: 'DEMO-10003', riskLevel: 'low' },
  ]);

  await CareTask.create([
    {
      patient: patients[0]!._id,
      title: 'Follow up on missing consent form',
      category: 'documentation',
      priority: 'high',
      status: 'open',
      assignedTo: staff._id,
      createdBy: admin._id,
    },
    {
      patient: patients[1]!._id,
      title: 'Confirm appointment for next week',
      category: 'appointment',
      priority: 'medium',
      status: 'in_progress',
      assignedTo: staff._id,
      createdBy: admin._id,
    },
    {
      patient: patients[0]!._id,
      title: 'Portal access blocked',
      category: 'access_issue',
      priority: 'urgent',
      status: 'blocked',
      blockedReason: 'Waiting on IT ticket',
      createdBy: admin._id,
    },
  ]);

  await AuditEvent.create({
    actor: admin._id,
    action: 'user.create',
    entityType: 'user',
    summary: 'Seeded demo users, patients and tasks (synthetic).',
  });

  logger.info('Demo data seeded (synthetic).');
}

// Run directly: `npm run seed`
if (require.main === module) {
  connectDb()
    .then(seedDemo)
    .then(disconnectDb)
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    });
}
