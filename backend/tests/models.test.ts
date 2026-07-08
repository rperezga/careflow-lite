import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connectDb, disconnectDb } from '../src/db/mongoose';
import { CareTask } from '../src/models/CareTask';
import { Patient } from '../src/models/Patient';
import { User } from '../src/models/User';

let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  // CI provides a MongoDB service container; locally we fall back to an in-memory server.
  let uri = process.env.MONGO_TEST_URI;
  if (!uri) {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri();
  }
  await connectDb(uri);
  // Ensure unique indexes are built before testing uniqueness constraints.
  await Promise.all([User.init(), Patient.init(), CareTask.init()]);
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Patient.deleteMany({}), CareTask.deleteMany({})]);
});

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
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
