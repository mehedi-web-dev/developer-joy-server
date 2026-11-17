import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'developerjoy';

let client = null;
let db = null;
let isConnected = false;
let isDummyClient = false;
let connectionPromise = null;

/**
 * Returns the MongoClient instance, creating it if it does not yet exist.
 * The driver natively buffers requests and manages connection pooling.
 */
export function getClient() {
  const activeUri = process.env.MONGODB_URI || uri;

  if (!client || (isDummyClient && activeUri)) {
    if (!activeUri) {
      // Gracefully prevent unhandled module evaluation crashes on serverless cold starts
      console.warn('[Database] MONGODB_URI is not defined in environment variables.');
      client = new MongoClient('mongodb://localhost:27017/developerjoy', {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      isDummyClient = true;
      return client;
    }

    if (isDummyClient && client) {
      try {
        client.close();
      } catch (_) {}
    }

    isDummyClient = false;
    client = new MongoClient(activeUri, {
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
  const activeUri = process.env.MONGODB_URI || uri;
  const activeDbName = process.env.DB_NAME || dbName;

  if (!db || (isDummyClient && activeUri)) {
    const activeClient = getClient();
    db = activeClient.db(activeDbName);
  }
  return db;
}

/**
 * Connects to MongoDB Atlas and verifies connectivity with a ping command.
 * Thread-safe / concurrency-safe: multiple callers share the same connection promise.
 */
export async function connectDB() {
  const activeUri = process.env.MONGODB_URI || uri;
  if (!activeUri) {
    throw new Error('[Database] MONGODB_URI is not defined in environment variables');
  }

  const activeDbName = process.env.DB_NAME || dbName;

  if (isConnected && db && client && !isDummyClient) {
    return db;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const activeClient = getClient();
      await activeClient.connect();
      db = activeClient.db(activeDbName);

      // Verify connection with a ping
      await db.command({ ping: 1 });
      isConnected = true;
      console.log(`[Database] Successfully connected to MongoDB database: "${activeDbName}"`);

      // Initialize indexes for projects collection
      await initializeProjectIndexes(db);
      return db;
    } catch (error) {
      isConnected = false;
      console.error('[Database] Failed to connect to MongoDB:', error.message);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Returns true if MongoDB connection has been successfully established and verified.
 */
export function isDBConnected() {
  return isConnected;
}

/**
 * Dynamic Proxies for Better Auth and external callers.
 * Resolves to the live, connected client and db instances even across serverless cold starts.
 */
export const clientProxy = new Proxy({}, {
  get(_target, prop) {
    const active = getClient();
    const val = active[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  },
});

export const dbProxy = new Proxy({}, {
  get(_target, prop) {
    const active = getDB();
    const val = active[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  },
});

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
    isConnected = false;
    connectionPromise = null;
    console.log('[Database] MongoDB connection closed');
  }
}
