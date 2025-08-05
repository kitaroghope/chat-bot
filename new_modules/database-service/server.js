import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import database from './config/database.js';
import userRoutes from './routes/users.js';
import genericRoutes from './routes/generic.js';
import { ErrorHandler, errorMiddleware } from './utils/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Dashboard UI route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api', genericRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test database connection based on type
        if (database.type === 'postgresql') {
            const client = await database.connection.connect();
            await client.query('SELECT NOW()');
            client.release();
        } else if (database.type === 'sqlite') {
            await database.query('SELECT datetime(\'now\')');
        } else if (database.type === 'mongodb') {
            await database.connection.db().admin().ping();
        }
        
        res.json({
            status: 'healthy',
            service: 'database-service',
            database: 'connected',
            database_type: database.type,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check failed:', error);
        const errorResponse = ErrorHandler.handleServiceUnavailableError('Database');
        res.status(503).json({
            status: 'unhealthy',
            service: 'database-service',
            database: 'disconnected',
            database_type: database.type,
            ...errorResponse,
            timestamp: new Date().toISOString()
        });
    }
});

// Database status endpoint
app.get('/api/status', async (req, res) => {
    try {
        let statusInfo = {
            database_type: database.type,
            timestamp: new Date().toISOString()
        };

        if (database.type === 'postgresql') {
            const client = await database.connection.connect();
            
            // Get database info
            const dbInfo = await client.query('SELECT version()');
            const tableCount = await client.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            client.release();
            
            statusInfo = {
                ...statusInfo,
                database_version: dbInfo.rows[0].version,
                table_count: parseInt(tableCount.rows[0].count),
                pool_total_count: database.connection.totalCount,
                pool_idle_count: database.connection.idleCount,
                pool_waiting_count: database.connection.waitingCount
            };
        } else if (database.type === 'sqlite') {
            const versionResult = await database.query('SELECT sqlite_version()');
            const tableCount = await database.query(`
                SELECT COUNT(*) as count 
                FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `);
            
            statusInfo = {
                ...statusInfo,
                database_version: `SQLite ${versionResult.rows[0]['sqlite_version()']}`,
                table_count: parseInt(tableCount.rows[0].count)
            };
        } else if (database.type === 'mongodb') {
            const admin = database.connection.db().admin();
            const buildInfo = await admin.buildInfo();
            const collections = await database.connection.db().listCollections().toArray();
            
            statusInfo = {
                ...statusInfo,
                database_version: `MongoDB ${buildInfo.version}`,
                collection_count: collections.length
            };
        }
        
        res.json(statusInfo);
    } catch (error) {
        console.error('Status check failed:', error);
        const errorResponse = ErrorHandler.handleDatabaseError(error, 'status check');
        res.status(errorResponse.error.statusCode).json(errorResponse);
    }
});

// 404 handler
app.use((req, res) => {
    const error = ErrorHandler.createError(
        `Route ${req.method} ${req.path} not found`,
        404,
        null,
        'ROUTE_NOT_FOUND'
    );
    res.status(404).json(error);
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down database service...');
    await database.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`🗄️  Database service running on port ${port}`);
    console.log(`💾 Database type: ${database.type.toUpperCase()}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📈 Status endpoint: http://localhost:${port}/api/status`);
    console.log(`👥 Users API: http://localhost:${port}/api/users`);
});