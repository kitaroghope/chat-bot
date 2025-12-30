import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

let db;
let dialect;
let vectors;

async function initDatabase() {
    if (DATABASE_URL?.startsWith('postgres')) {
        // PostgreSQL (Neon, etc.) - use neon serverless driver
        const { neon } = await import('@neondatabase/serverless');
        const { drizzle } = await import('drizzle-orm/neon-http');
        const { pgVectors } = await import('./schema.js');

        const client = neon(DATABASE_URL);
        db = drizzle(client, { schema: { vectors: pgVectors } });
        vectors = pgVectors;
        dialect = 'postgresql';
        console.log('Connected to PostgreSQL (Neon)');
    } else if (DATABASE_URL?.startsWith('mongodb')) {
        // MongoDB
        const { MongoClient } = await import('mongodb');
        const { drizzle } = await import('drizzle-orm/mongodb');
        dialect = 'mongodb';
        const client = new MongoClient(DATABASE_URL);
        await client.connect();
        db = drizzle(client);
        vectors = null;
        console.log('Connected to MongoDB');
    } else {
        // SQLite (default)
        const Database = (await import('better-sqlite3')).default;
        const { drizzle } = await import('drizzle-orm/better-sqlite3');
        const { sqliteVectors } = await import('./schema.js');

        const dbPath = DATABASE_URL || path.join(__dirname, '..', 'vectors.db');
        const sqlite = new Database(dbPath);
        db = drizzle(sqlite, { schema: { vectors: sqliteVectors } });
        vectors = sqliteVectors;
        dialect = 'sqlite';
        console.log('Connected to SQLite:', dbPath);
    }
}

export { initDatabase, getDb, getVectors, getDialect };

function getDb() { return db; }
function getVectors() { return vectors; }
function getDialect() { return dialect; }
