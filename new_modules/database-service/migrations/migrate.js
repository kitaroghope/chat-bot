import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
    constructor() {
        this.database = database;
    }

    async initialize() {
        await this.database.ensureInitialized();
    }

    async createMigrationsTable() {
        if (this.database.type === 'mongodb') {
            // MongoDB doesn't need explicit table creation
            return;
        }

        let query;
        if (this.database.type === 'postgresql') {
            query = `
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) UNIQUE NOT NULL,
                    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `;
        } else if (this.database.type === 'sqlite') {
            query = `
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename VARCHAR(255) UNIQUE NOT NULL,
                    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
        }

        if (this.database.type === 'postgresql') {
            const client = await this.database.connection.connect();
            try {
                await client.query(query);
            } finally {
                client.release();
            }
        } else {
            await this.database.query(query);
        }
    }

    async getExecutedMigrations() {
        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection('migrations');
            const docs = await collection.find({}).sort({ executed_at: 1 }).toArray();
            return docs.map(doc => doc.filename);
        }

        const query = 'SELECT filename FROM migrations ORDER BY id';
        let rows;

        if (this.database.type === 'postgresql') {
            const client = await this.database.connection.connect();
            try {
                const result = await client.query(query);
                rows = result.rows;
            } finally {
                client.release();
            }
        } else {
            const result = await this.database.query(query);
            rows = result.rows;
        }

        return rows.map(row => row.filename);
    }

    async recordMigration(filename) {
        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection('migrations');
            await collection.insertOne({
                filename,
                executed_at: new Date()
            });
            return;
        }

        const query = 'INSERT INTO migrations (filename) VALUES ($1)';
        
        if (this.database.type === 'postgresql') {
            const client = await this.database.connection.connect();
            try {
                await client.query(query, [filename]);
            } finally {
                client.release();
            }
        } else {
            await this.database.query(query, [filename]);
        }
    }

    async runSQLMigration(filename, sql) {
        if (this.database.type === 'postgresql') {
            const client = await this.database.connection.connect();
            try {
                await client.query('BEGIN');
                try {
                    // Replace PostgreSQL-specific syntax for other databases
                    if (this.database.type === 'sqlite') {
                        sql = this.convertPostgresToSQLite(sql);
                    }
                    
                    await client.query(sql);
                    await this.recordMigration(filename);
                    await client.query('COMMIT');
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                }
            } finally {
                client.release();
            }
        } else {
            // SQLite doesn't support transactions for DDL in the same way
            try {
                if (this.database.type === 'sqlite') {
                    sql = this.convertPostgresToSQLite(sql);
                }
                
                // Split SQL into individual statements for SQLite
                const statements = sql.split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '');
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        try {
                            await this.database.query(statement + ';');
                        } catch (error) {
                            // Skip some PostgreSQL-specific commands that SQLite doesn't support
                            if (error.message.includes('near "EXTENSION"') || 
                                error.message.includes('vector') ||
                                error.message.includes('ivfflat') ||
                                error.message.includes('already exists')) {
                                console.log(`⚠️  Skipping statement (${error.message}): ${statement.substring(0, 50)}...`);
                                continue;
                            }
                            throw error;
                        }
                    }
                }
                
                await this.recordMigration(filename);
            } catch (error) {
                throw error;
            }
        }
    }

    convertPostgresToSQLite(sql) {
        return sql
            // Remove comments
            .replace(/--.*$/gm, '')
            
            // Replace UUID type and generation
            .replace(/UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/g, 'TEXT PRIMARY KEY')
            .replace(/UUID REFERENCES/g, 'TEXT REFERENCES')
            .replace(/UUID/g, 'TEXT')
            
            // Replace TIMESTAMP WITH TIME ZONE
            .replace(/TIMESTAMP WITH TIME ZONE/g, 'DATETIME')
            .replace(/DEFAULT NOW\(\)/g, 'DEFAULT CURRENT_TIMESTAMP')
            
            // Replace SERIAL
            .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
            
            // Replace BIGINT
            .replace(/BIGINT/g, 'INTEGER')
            
            // Replace INET
            .replace(/INET/g, 'TEXT')
            
            // Replace JSONB
            .replace(/JSONB/g, 'TEXT')
            
            // Remove vector extension and vector types
            .replace(/CREATE EXTENSION IF NOT EXISTS vector;/g, '')
            .replace(/embedding vector\(384\)/g, 'embedding TEXT')
            .replace(/USING ivfflat \(embedding vector_cosine_ops\)/g, '')
            
            // Keep IF NOT EXISTS for indexes in SQLite
            .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX IF NOT EXISTS')
            
            // Fix foreign key syntax (SQLite handles them differently)
            .replace(/ON DELETE CASCADE/g, '')
            .replace(/ON DELETE SET NULL/g, '')
            
            // Fix boolean type
            .replace(/BOOLEAN/g, 'INTEGER')
            
            // Remove empty lines
            .replace(/^\s*\n/gm, '');
    }

    async runMongoMigration(filename) {
        // For MongoDB, we'll create collections and indexes
        console.log(`Setting up MongoDB collections and indexes for ${filename}`);
        
        const collections = [
            'users', 'conversations', 'messages', 'documents', 
            'document_chunks', 'whatsapp_messages', 'ai_requests', 
            'web_sessions', 'system_logs'
        ];

        for (const collectionName of collections) {
            try {
                await this.database.connection.db().createCollection(collectionName);
            } catch (error) {
                // Collection might already exist
                if (!error.message.includes('already exists')) {
                    console.warn(`Warning creating collection ${collectionName}:`, error.message);
                }
            }
        }

        // Create indexes
        const db = this.database.connection.db();
        
        // Users indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
        await db.collection('users').createIndex({ whatsapp_id: 1 });
        
        // Conversations indexes
        await db.collection('conversations').createIndex({ user_id: 1 });
        await db.collection('conversations').createIndex({ type: 1 });
        await db.collection('conversations').createIndex({ status: 1 });
        await db.collection('conversations').createIndex({ created_at: -1 });
        
        // Messages indexes
        await db.collection('messages').createIndex({ conversation_id: 1 });
        await db.collection('messages').createIndex({ user_id: 1 });
        await db.collection('messages').createIndex({ created_at: -1 });
        await db.collection('messages').createIndex({ sender_type: 1 });
        
        // Documents indexes
        await db.collection('documents').createIndex({ user_id: 1 });
        await db.collection('documents').createIndex({ status: 1 });
        await db.collection('documents').createIndex({ created_at: -1 });
        
        // Document chunks indexes
        await db.collection('document_chunks').createIndex({ document_id: 1 });
        
        // WhatsApp messages indexes
        await db.collection('whatsapp_messages').createIndex({ phone_number: 1 });
        await db.collection('whatsapp_messages').createIndex({ user_id: 1 });
        await db.collection('whatsapp_messages').createIndex({ status: 1 });
        await db.collection('whatsapp_messages').createIndex({ created_at: -1 });
        await db.collection('whatsapp_messages').createIndex({ whatsapp_message_id: 1 }, { unique: true });
        
        // AI requests indexes
        await db.collection('ai_requests').createIndex({ user_id: 1 });
        await db.collection('ai_requests').createIndex({ conversation_id: 1 });
        await db.collection('ai_requests').createIndex({ service_type: 1 });
        await db.collection('ai_requests').createIndex({ status: 1 });
        await db.collection('ai_requests').createIndex({ created_at: -1 });
        
        // Web sessions indexes
        await db.collection('web_sessions').createIndex({ user_id: 1 });
        await db.collection('web_sessions').createIndex({ session_id: 1 }, { unique: true });
        await db.collection('web_sessions').createIndex({ status: 1 });
        
        // System logs indexes
        await db.collection('system_logs').createIndex({ service_name: 1 });
        await db.collection('system_logs').createIndex({ user_id: 1 });
        await db.collection('system_logs').createIndex({ level: 1 });
        await db.collection('system_logs').createIndex({ created_at: -1 });

        await this.recordMigration(filename);
    }

    async runMigrations() {
        try {
            console.log(`🗄️  Running migrations for ${this.database.type.toUpperCase()} database...`);
            
            await this.initialize();
            await this.createMigrationsTable();
            
            // Get all migration files
            let migrationFiles = fs.readdirSync(__dirname)
                .filter(file => file.endsWith('.sql'))
                .sort();

            // For SQLite, prefer SQLite-specific files if they exist
            if (this.database.type === 'sqlite') {
                const sqliteFiles = migrationFiles.filter(file => file.includes('sqlite'));
                if (sqliteFiles.length > 0) {
                    migrationFiles = sqliteFiles;
                } else {
                    // Filter out database-specific files and use generic ones
                    migrationFiles = migrationFiles.filter(file => !file.includes('postgresql') && !file.includes('mongodb'));
                }
            } else if (this.database.type === 'postgresql') {
                // For PostgreSQL, prefer PostgreSQL-specific files or generic ones
                const pgFiles = migrationFiles.filter(file => file.includes('postgresql') || (!file.includes('sqlite') && !file.includes('mongodb')));
                migrationFiles = pgFiles;
            } else if (this.database.type === 'mongodb') {
                // For MongoDB, we'll use the generic schema to create collections
                migrationFiles = migrationFiles.filter(file => !file.includes('sqlite') && !file.includes('postgresql'));
            }

            // Check which migrations have already been run
            const executedFilenames = await this.getExecutedMigrations();

            // Run pending migrations
            for (const filename of migrationFiles) {
                if (!executedFilenames.includes(filename)) {
                    console.log(`Running migration: ${filename}`);
                    
                    if (this.database.type === 'mongodb') {
                        await this.runMongoMigration(filename);
                    } else {
                        const migrationSQL = fs.readFileSync(
                            path.join(__dirname, filename), 
                            'utf8'
                        );
                        await this.runSQLMigration(filename, migrationSQL);
                    }
                    
                    console.log(`✅ Migration ${filename} completed successfully`);
                } else {
                    console.log(`⏭️  Migration ${filename} already executed`);
                }
            }

            console.log('🎉 All migrations completed successfully!');
        } catch (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        } finally {
            await this.database.close();
        }
    }
}

// Run migrations
const runner = new MigrationRunner();
runner.runMigrations();