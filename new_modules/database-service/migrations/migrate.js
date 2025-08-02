import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    const client = await pool.connect();
    
    try {
        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Get all migration files
        const migrationFiles = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // Check which migrations have already been run
        const { rows: executedMigrations } = await client.query(
            'SELECT filename FROM migrations ORDER BY id'
        );
        const executedFilenames = executedMigrations.map(row => row.filename);

        // Run pending migrations
        for (const filename of migrationFiles) {
            if (!executedFilenames.includes(filename)) {
                console.log(`Running migration: ${filename}`);
                
                const migrationSQL = fs.readFileSync(
                    path.join(__dirname, filename), 
                    'utf8'
                );
                
                await client.query('BEGIN');
                try {
                    await client.query(migrationSQL);
                    await client.query(
                        'INSERT INTO migrations (filename) VALUES ($1)',
                        [filename]
                    );
                    await client.query('COMMIT');
                    console.log(`✅ Migration ${filename} completed successfully`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`❌ Migration ${filename} failed:`, error.message);
                    throw error;
                }
            } else {
                console.log(`⏭️  Migration ${filename} already executed`);
            }
        }

        console.log('🎉 All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();