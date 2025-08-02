import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import pool from './config/database.js';
import userRoutes from './routes/users.js';
import genericRoutes from './routes/generic.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api', genericRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        
        res.json({
            status: 'healthy',
            service: 'database-service',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            service: 'database-service',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Database status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const client = await pool.connect();
        
        // Get database info
        const dbInfo = await client.query('SELECT version()');
        const tableCount = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        client.release();
        
        res.json({
            database_version: dbInfo.rows[0].version,
            table_count: parseInt(tableCount.rows[0].count),
            pool_total_count: pool.totalCount,
            pool_idle_count: pool.idleCount,
            pool_waiting_count: pool.waitingCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Status check failed:', error);
        res.status(500).json({
            error: 'Failed to get database status',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down database service...');
    await pool.end();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`🗄️  Database service running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📈 Status endpoint: http://localhost:${port}/api/status`);
    console.log(`👥 Users API: http://localhost:${port}/api/users`);
});