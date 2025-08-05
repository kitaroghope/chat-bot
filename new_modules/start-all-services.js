#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Service configurations
const services = [
    {
        name: 'Database Service',
        path: path.join(__dirname, 'database-service'),
        port: 3005,
        color: '\x1b[36m', // Cyan
        env: { PORT: '3005', NODE_ENV: 'development' }
    },
    {
        name: 'Document Service',
        path: path.join(__dirname, 'document-service'),
        port: 3001,
        color: '\x1b[32m', // Green
        env: { PORT: '3001', DATABASE_SERVICE_URL: 'http://localhost:3005' }
    },
    {
        name: 'AI Service',
        path: path.join(__dirname, 'ai-service'),
        port: 3002,
        color: '\x1b[33m', // Yellow
        env: { PORT: '3002', DATABASE_SERVICE_URL: 'http://localhost:3005' }
    },
    {
        name: 'WhatsApp Service',
        path: path.join(__dirname, 'whatsapp-service'),
        port: 3003,
        color: '\x1b[35m', // Magenta
        env: { 
            PORT: '3003',
            AI_SERVICE_URL: 'http://localhost:3002',
            DOCUMENT_SERVICE_URL: 'http://localhost:3001'
        }
    },
    {
        name: 'Web Interface',
        path: path.join(__dirname, 'web-interface'),
        port: 3004,
        color: '\x1b[34m', // Blue
        env: { 
            PORT: '3004',
            API_GATEWAY_URL: 'http://localhost:3000'
        }
    },
    {
        name: 'API Gateway',
        path: path.join(__dirname, 'api-gateway'),
        port: 3000,
        color: '\x1b[31m', // Red
        env: {
            PORT: '3000',
            DOCUMENT_SERVICE_URL: 'http://localhost:3001',
            AI_SERVICE_URL: 'http://localhost:3002',
            WHATSAPP_SERVICE_URL: 'http://localhost:3003',
            WEB_SERVICE_URL: 'http://localhost:3004',
            DATABASE_SERVICE_URL: 'http://localhost:3005'
        }
    }
];

const runningProcesses = [];

// Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m'
};

function log(serviceName, message, color = '') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${color}[${timestamp}] [${serviceName}]${colors.reset} ${message}`);
}

function startService(service) {
    return new Promise((resolve, reject) => {
        log(service.name, `Starting on port ${service.port}...`, service.color);

        const child = spawn('node', ['server.js'], {
            cwd: service.path,
            env: { ...process.env, ...service.env },
            stdio: 'pipe'
        });

        runningProcesses.push({ name: service.name, process: child });

        child.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
                log(service.name, message, service.color);
            }
        });

        child.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
                log(service.name, `ERROR: ${message}`, service.color);
            }
        });

        child.on('error', (error) => {
            log(service.name, `Failed to start: ${error.message}`, service.color);
            reject(error);
        });

        // Wait a bit for the service to start
        setTimeout(() => {
            if (!child.killed) {
                log(service.name, `Started successfully on port ${service.port}`, service.color);
                resolve();
            }
        }, 2000);

        child.on('exit', (code, signal) => {
            if (code !== 0 && signal !== 'SIGTERM') {
                log(service.name, `Exited with code ${code}`, service.color);
            }
        });
    });
}

async function startAllServices() {
    console.log(`${colors.bright}🚀 Starting Chat Bot Microservices...${colors.reset}\n`);

    try {
        // Start services in order (database first, then others)
        for (const service of services) {
            await startService(service);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between starts
        }

        console.log(`\n${colors.bright}✅ All services started successfully!${colors.reset}`);
        console.log(`${colors.bright}📊 Service URLs:${colors.reset}`);
        services.forEach(service => {
            console.log(`  ${service.color}${service.name}${colors.reset}: http://localhost:${service.port}`);
        });

        console.log(`\n${colors.bright}🌐 Main Application: http://localhost:3000${colors.reset}`);
        console.log(`${colors.bright}📱 WhatsApp Webhook: http://localhost:3000/webhook/whatsapp${colors.reset}`);
        console.log(`\n${colors.dim}Press Ctrl+C to stop all services${colors.reset}`);

    } catch (error) {
        console.error(`\n${colors.bright}❌ Failed to start services:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n${colors.bright}🛑 Stopping all services...${colors.reset}`);
    
    runningProcesses.forEach(({ name, process }) => {
        if (!process.killed) {
            log(name, 'Stopping...', colors.dim);
            process.kill('SIGTERM');
        }
    });

    setTimeout(() => {
        console.log(`${colors.bright}✅ All services stopped${colors.reset}`);
        process.exit(0);
    }, 2000);
});

// Start the services
startAllServices().catch((error) => {
    console.error(`${colors.bright}❌ Startup failed:${colors.reset}`, error);
    process.exit(1);
});