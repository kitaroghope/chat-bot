import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import DatabaseClient from './utils/DatabaseClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3004"],
        methods: ["GET", "POST"]
    }
});

const port = process.env.PORT || 3004;

// Database client
const db = new DatabaseClient();

// Service URLs
const services = {
    gateway: process.env.API_GATEWAY_URL || 'https://chat-bot-00.onrender.com',
    document: process.env.DOCUMENT_SERVICE_URL || 'https://chat-bot-01.onrender.com',
    ai: process.env.AI_SERVICE_URL || 'https://chat-bot-02-pony.onrender.com',
    whatsapp: process.env.WHATSAPP_SERVICE_URL || 'https://chat-bot-03.onrender.com'
};

// Session management
const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve main chat interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuration interface
app.get('/config', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const checkDeps = req.query.deps !== 'false';
        const serviceHealth = {};
        
        if (checkDeps) {
            for (const [name, url] of Object.entries(services)) {
                try {
                    console.log(`Checking health of ${name} at ${url}`);
                    const response = await axios.get(`${url}/health?deps=false`, { timeout: 5000 });
                    serviceHealth[name] = 'healthy';
                } catch (error) {
                    serviceHealth[name] = 'unhealthy';
                }
            }
            console.log('Service health:', serviceHealth);
        }
        
        const responseData = {
            status: 'healthy',
            active_sessions: sessions.size,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
        
        if (checkDeps) {
            responseData.services = serviceHealth;
        }
        
        res.json(responseData);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get configuration
app.get('/api/config', (req, res) => {
    res.json({
        services: services,
        session_timeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour
        max_message_length: parseInt(process.env.MAX_MESSAGE_LENGTH) || 1000,
        upload_enabled: process.env.UPLOAD_ENABLED !== 'false',
        whatsapp_enabled: process.env.WHATSAPP_ENABLED !== 'false'
    });
});

// Update service URLs
app.post('/api/config/services', (req, res) => {
    const { serviceName, url } = req.body;
    
    if (services.hasOwnProperty(serviceName)) {
        services[serviceName] = url;
        res.json({ success: true, message: `${serviceName} URL updated to ${url}` });
    } else {
        res.status(400).json({ error: 'Invalid service name' });
    }
});

// Web chat endpoint
app.post('/web-chat', async (req, res) => {
    try {
        const { message, session_id } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Create or update session
        const sessionId = session_id || generateSessionId();
        updateSession(sessionId);

        // Route to API Gateway
        const response = await axios.post(`${services.gateway}/chat`, {
            message: message
        });

        const chatResponse = {
            response: response.data.response,
            session_id: sessionId,
            timestamp: new Date().toISOString(),
            sources: response.data.sources || [],
            processing_time: response.data.processing_time || 0
        };

        // Emit to socket if connected
        io.to(sessionId).emit('chat-response', chatResponse);

        res.json(chatResponse);

    } catch (error) {
        console.error('Web chat error:', error);
        res.status(500).json({
            error: 'Sorry, I encountered an error processing your message.',
            details: error.message,
            session_id: req.body.session_id,
            timestamp: new Date().toISOString()
        });
    }
});

// File upload endpoint
app.post('/upload', async (req, res) => {
    try {
        const { file_data, filename } = req.body;
        
        if (!file_data || !filename) {
            return res.status(400).json({ error: 'File data and filename are required' });
        }

        // Route to API Gateway
        const response = await axios.post(`${services.gateway}/upload`, {
            file_data: file_data,
            filename: filename
        });

        res.json(response.data);

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Failed to upload file',
            details: error.message
        });
    }
});

// Get chat history (placeholder - could be implemented with database)
app.get('/api/chat-history/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    // For now, return empty history
    // In a full implementation, this would query a database
    res.json({
        session_id: sessionId,
        messages: [],
        created_at: new Date().toISOString()
    });
});

// Get service status
app.get('/api/services/status', async (req, res) => {
    try {
        const serviceStatus = {};
        
        for (const [name, url] of Object.entries(services)) {
            try {
                const response = await axios.get(`${url}/health`, { timeout: 3000 });
                serviceStatus[name] = {
                    status: 'healthy',
                    url: url,
                    response_time: response.headers['x-response-time'] || 'N/A'
                };
            } catch (error) {
                serviceStatus[name] = {
                    status: 'unhealthy',
                    url: url,
                    error: error.message
                };
            }
        }
        
        res.json(serviceStatus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join session room
    socket.on('join-session', (sessionId) => {
        socket.join(sessionId);
        updateSession(sessionId);
        console.log(`User ${socket.id} joined session ${sessionId}`);
    });
    
    // Handle chat messages via socket
    socket.on('chat-message', async (data) => {
        try {
            const { message, session_id } = data;
            
            if (!message) {
                socket.emit('error', { message: 'Message is required' });
                return;
            }

            const sessionId = session_id || generateSessionId();
            updateSession(sessionId);

            // Emit typing indicator
            socket.to(sessionId).emit('typing', { user: 'bot', typing: true });

            // Route to API Gateway
            const response = await axios.post(`${services.gateway}/chat`, {
                message: message
            });

            const chatResponse = {
                response: response.data.response,
                session_id: sessionId,
                timestamp: new Date().toISOString(),
                sources: response.data.sources || [],
                processing_time: response.data.processing_time || 0
            };
            console.log('1-0');
            // Stop typing indicator
            socket.to(sessionId).emit('typing', { user: 'bot', typing: false });
            console.log('1-1');
            // Emit response
            io.to(sessionId).emit('chat-response', chatResponse);

        } catch (error) {
            console.error('Socket chat error:', error.code);
            socket.emit('error', {
                message: 'Sorry, I encountered an error processing your message.',
                details: error.message
            });
        }
    });
    
    // Handle file uploads via socket
    socket.on('file-upload', async (data) => {
        try {
            const { file_data, filename, session_id } = data;
            
            if (!file_data || !filename) {
                socket.emit('error', { message: 'File data and filename are required' });
                return;
            }

            // Emit upload progress
            socket.emit('upload-progress', { stage: 'uploading', percent: 10 });

            // Route to API Gateway
            const response = await axios.post(`${services.gateway}/upload`, {
                file_data: file_data,
                filename: filename
            });

            socket.emit('upload-progress', { stage: 'complete', percent: 100 });
            socket.emit('upload-complete', response.data);

        } catch (error) {
            console.error('Socket upload error:', error);
            socket.emit('upload-error', {
                message: 'Failed to upload file',
                details: error.message
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Utility functions
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function updateSession(sessionId) {
    sessions.set(sessionId, {
        id: sessionId,
        last_activity: new Date(),
        created_at: sessions.get(sessionId)?.created_at || new Date()
    });
}

// Clean up old sessions periodically
setInterval(() => {
    const timeout = parseInt(process.env.SESSION_TIMEOUT) || 3600000; // 1 hour
    const now = new Date();
    
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.last_activity > timeout) {
            sessions.delete(sessionId);
            console.log(`Cleaned up expired session: ${sessionId}`);
        }
    }
}, 300000); // Check every 5 minutes

server.listen(port, () => {
    console.log(`Web interface service running on port ${port}`);
    console.log(`Chat interface: http://localhost:${port}`);
    console.log(`Configuration: http://localhost:${port}/config`);
    console.log('Service URLs:');
    Object.entries(services).forEach(([name, url]) => {
        console.log(`  ${name}: ${url}`);
    });
});