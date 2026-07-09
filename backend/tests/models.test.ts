import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CareTask } from '../src/models/CareTask';
import { Patient } from '../src/models/Patient';
import { User } from '../src/models/User';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

beforeAll(async () => {
  await setupTestDb();
  await Promise.all([User.init(), Patient.init(), CareTask.init()]);
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Patient.deleteMany({}), CareTask.deleteMany({})]);
});

afterAll(async () => {
  await teardownTestDb();
});

describe('User model', () => {
  it('requires an email', async () => {
    await expect(User.create({ name: 'No Email', passwordHash: 'x' })).rejects.toThrow();
  });

  it('rejects duplicate emails', async () => {
    await User.create({ name: 'A', email: 'dup@example.com', passwordHash: 'x' });
    await expect(
      User.create({ name: 'B', email: 'dup@example.com', passwordHash: 'x' }),
    ).rejects.toThrow();
  });
});

describe('Patient model', () => {
  it('requires firstName, lastName and memberId', async () => {
    await expect(Patient.create({ firstName: 'Only' })).rejects.toThrow();
  });
});

describe('CareTask model', () => {
  it('requires patient and title', async () => {
    await expect(CareTask.create({ title: 'No patient' })).rejects.toThrow();
  });

  it('requires blockedReason when status is blocked', async () => {
    const patient = await Patient.create({ firstName: 'P', lastName: 'Q', memberId: 'DEMO-B1' });
    const creator = await User.create({ name: 'C', email: 'c@example.com', passwordHash: 'x' });
    await expect(
      CareTask.create({
        patient: patient._id,
        title: 'x',
        status: 'blocked',
        createdBy: creator._id,
      }),
    ).rejects.toThrow(/blockedReason/);
  });

  it('sets completedAt when a task is done', async () => {
    const patient = await Patient.create({ firstName: 'P', lastName: 'Q', memberId: 'DEMO-B2' });
    const creator = await User.create({ name: 'C', email: 'd@example.com', passwordHash: 'x' });
    const task = await CareTask.create({
      patient: patient._id,
      title: 'done task',
      status: 'done',
      createdBy: creator._id,
    });
    expect(task.completedAt).toBeInstanceOf(Date);
  });
});
