import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'developerjoy';

let client = null;
let db = null;
let connectionPromise = null;

/**
 * Returns the MongoClient instance, creating it if it does not yet exist.
 * The driver natively buffers requests and manages connection pooling.
 */
export function getClient() {
  if (!client) {
    if (!uri) {
      throw new Error('[Database] MONGODB_URI is not defined in environment variables');
    }
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
    });
  }
  return client;
}

/**
 * Returns the active MongoDB Db instance.
 */
export function getDB() {
  if (!db) {
    const activeClient = getClient();
    db = activeClient.db(dbName);
  }
  return db;
}

/**
 * Connects to MongoDB Atlas and verifies connectivity with a ping command.
 * Thread-safe / concurrency-safe: multiple callers share the same connection promise.
 */
export async function connectDB() {
  if (!uri) {
    throw new Error('[Database] MONGODB_URI is not defined in environment variables');
  }

  if (db && client) {
    return db;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const activeClient = getClient();
      await activeClient.connect();
      db = activeClient.db(dbName);

      // Verify connection with a ping
      await db.command({ ping: 1 });
      console.log(`[Database] Successfully connected to MongoDB database: "${dbName}"`);

      // Initialize indexes for projects collection
      await initializeProjectIndexes(db);
      return db;
    } catch (error) {
      console.error('[Database] Failed to connect to MongoDB:', error.message);
      connectionPromise = null;
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Ensures indexes exist on the projects collection.
 */
export async function initializeProjectIndexes(database) {
  try {
    const collection = database.collection('projects');
    await collection.createIndex({ slug: 1 }, { unique: true });
    await collection.createIndex({ status: 1, createdAt: -1 });
    await collection.createIndex({ category: 1 });
    await collection.createIndex({ featured: 1 });
    console.log('[Database] Verified indexes for "projects" collection');
  } catch (error) {
    console.warn('[Database] Warning: Failed to create project indexes:', error.message);
  }
}

/**
 * Gracefully closes the MongoDB client connection.
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    connectionPromise = null;
    console.log('[Database] MongoDB connection closed');
  }
}
