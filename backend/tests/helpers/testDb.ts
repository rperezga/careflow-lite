import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../../src/db/mongoose';

let mongo: MongoMemoryServer | undefined;

// Give each test file an isolated database so suites never collide,
// against either the CI MongoDB container or a local in-memory server.
export async function setupTestDb(): Promise<void> {
  const base = process.env.MONGO_TEST_URI;
  if (base) {
    mongoose.set('strictQuery', true);
    const dbName = `cft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await mongoose.connect(base, { dbName });
    return;
  }
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
  if (mongo) {
    await mongo.stop();
    mongo = undefined;
  }
}
