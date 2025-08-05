import pg from 'pg';
import sqlite3 from 'sqlite3';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';

class DatabaseAdapter {
    constructor() {
        this.type = DATABASE_TYPE;
        this.connection = null;
        this.initialized = false;
        this.initPromise = this.init();
    }

    async init() {
        if (this.initialized) return;
        
        try {
            switch (this.type) {
                case 'postgresql':
                    await this.initPostgreSQL();
                    break;
                case 'mongodb':
                    await this.initMongoDB();
                    break;
                case 'sqlite':
                default:
                    await this.initSQLite();
                    break;
            }
            this.initialized = true;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
        }
    }

    async initPostgreSQL() {
        const { Pool } = pg;
        this.connection = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.connection.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
        });
    }

    async initSQLite() {
        const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'database.sqlite');
        
        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        const fs = await import('fs');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.connection = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening SQLite database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    // Enable foreign keys
                    this.connection.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
                        if (pragmaErr) {
                            console.error('Error enabling foreign keys:', pragmaErr);
                            reject(pragmaErr);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }

    async initMongoDB() {
        const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/chatbot';
        this.connection = new MongoClient(mongoUrl);
        await this.connection.connect();
        console.log('Connected to MongoDB');
    }

    async query(sql, params = []) {
        await this.ensureInitialized();
        
        switch (this.type) {
            case 'postgresql':
                return await this.connection.query(sql, params);
            case 'sqlite':
                return await this.querySQLite(sql, params);
            case 'mongodb':
                throw new Error('Use MongoDB-specific methods for MongoDB operations');
            default:
                throw new Error(`Unsupported database type: ${this.type}`);
        }
    }

    async querySQLite(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                this.connection.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                this.connection.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve({ 
                        rows: [], 
                        rowCount: this.changes,
                        lastID: this.lastID 
                    });
                });
            }
        });
    }

    // MongoDB specific methods
    async getCollection(collectionName) {
        if (this.type !== 'mongodb') {
            throw new Error('getCollection is only available for MongoDB');
        }
        await this.ensureInitialized();
        const dbName = process.env.MONGODB_DATABASE || 'chatbot';
        return this.connection.db(dbName).collection(collectionName);
    }

    async close() {
        if (this.connection) {
            switch (this.type) {
                case 'postgresql':
                    await this.connection.end();
                    break;
                case 'sqlite':
                    this.connection.close();
                    break;
                case 'mongodb':
                    await this.connection.close();
                    break;
            }
        }
    }

    // Utility methods for cross-database compatibility
    escapeIdentifier(identifier) {
        switch (this.type) {
            case 'postgresql':
                return `"${identifier}"`;
            case 'sqlite':
                return `"${identifier}"`;
            case 'mongodb':
                return identifier; // MongoDB doesn't use SQL identifiers
            default:
                return identifier;
        }
    }

    getTimestampType() {
        switch (this.type) {
            case 'postgresql':
                return 'TIMESTAMP WITH TIME ZONE';
            case 'sqlite':
                return 'DATETIME';
            case 'mongodb':
                return 'Date';
            default:
                return 'DATETIME';
        }
    }

    getUUIDType() {
        switch (this.type) {
            case 'postgresql':
                return 'UUID';
            case 'sqlite':
                return 'TEXT';
            case 'mongodb':
                return 'String';
            default:
                return 'TEXT';
        }
    }
}

const database = new DatabaseAdapter();

export { DatabaseAdapter };
export default database;