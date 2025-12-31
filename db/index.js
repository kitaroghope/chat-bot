import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

let db;
let dialect;
let vectors; // Legacy - for backward compatibility
let documents;
let vectorChunks;

async function initDatabase() {
    if (DATABASE_URL?.startsWith('postgres')) {
        // PostgreSQL (Neon, etc.) - use neon serverless driver
        const { neon } = await import('@neondatabase/serverless');
        const { drizzle } = await import('drizzle-orm/neon-http');
        const { pgDocuments, pgVectorChunks, pgVectors } = await import('./schema.js');

        const client = neon(DATABASE_URL);
        db = drizzle(client, {
            schema: {
                documents: pgDocuments,
                vectorChunks: pgVectorChunks,
                vectors: pgVectors // Legacy for backward compatibility
            }
        });
        documents = pgDocuments;
        vectorChunks = pgVectorChunks;
        vectors = pgVectors; // Legacy
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
        documents = null;
        vectorChunks = null;
        console.log('Connected to MongoDB');
    } else {
        // SQLite (default)
        const Database = (await import('better-sqlite3')).default;
        const { drizzle } = await import('drizzle-orm/better-sqlite3');
        const { sqliteDocuments, sqliteVectorChunks, sqliteVectors } = await import('./schema.js');

        const dbPath = DATABASE_URL || path.join(__dirname, '..', 'vectors.db');
        const sqlite = new Database(dbPath);
        db = drizzle(sqlite, {
            schema: {
                documents: sqliteDocuments,
                vectorChunks: sqliteVectorChunks,
                vectors: sqliteVectors // Legacy for backward compatibility
            }
        });
        documents = sqliteDocuments;
        vectorChunks = sqliteVectorChunks;
        vectors = sqliteVectors; // Legacy
        dialect = 'sqlite';
        console.log('Connected to SQLite:', dbPath);
    }
}

export { initDatabase, getDb, getVectors, getDialect, getDocuments, getVectorChunks };

function getDb() { return db; }
function getVectors() { return vectors; }
function getDialect() { return dialect; }
function getDocuments() { return documents; }
function getVectorChunks() { return vectorChunks; }
