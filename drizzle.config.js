import 'dotenv';
import { defineConfig } from 'drizzle-kit';

const DATABASE_URL = process.env.DATABASE_URL;

let dialect = 'sqlite';
let dbCredentials = { url: './vectors.db' };

if (DATABASE_URL?.startsWith('postgres')) {
    dialect = 'postgresql';
    dbCredentials = { url: DATABASE_URL };
} else if (DATABASE_URL?.startsWith('mongodb')) {
    dialect = 'mongodb';
    dbCredentials = { url: DATABASE_URL };
}

export default defineConfig({
    schema: './db/schema.js',
    out: './drizzle',
    dialect,
    dbCredentials,
    force: true,
});
