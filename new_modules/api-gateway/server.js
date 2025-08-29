import express from 'express';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import FormData from 'form-data';
import { resilientHttpCall, ServiceBreakers } from './utils/circuitBreaker.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

// Initialize service breakers
const serviceBreakers = new ServiceBreakers();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Service URLs from environment variables
const services = {
    document: process.env.DOCUMENT_SERVICE_URL || 'https://chat-bot-01.onrender.com',
    ai: process.env.AI_SERVICE_URL || 'https://chat-bot-02-pony.onrender.com',
    whatsapp: process.env.WHATSAPP_SERVICE_URL || 'https://chat-bot-03.onrender.com',
    web: process.env.WEB_SERVICE_URL || 'https://chat-bot-04.onrender.com',
    database: process.env.DATABASE_SERVICE_URL || 'https://chat-bot-05.onrender.com'
};

// Health check endpoint
app.get('/health', async (req, res) => {
    const checkDeps = req.query.deps !== 'false';
    const serviceHealth = {};
    
    if (checkDeps) {
        for (const [name, url] of Object.entries(services)) {
            try {
                const response = await serviceBreakers.callService(name, async () => {
                    return axios.get(`${url}/health?deps=false`, { timeout: 5000 });
                });
                serviceHealth[name] = response.data.status || 'healthy';
            } catch (error) {
                serviceHealth[name] = 'unhealthy';
            }
        }
    }
    
    const responseData = {
        status: 'healthy',
        timestamp: new Date().toISOString()
    };
    
    if (checkDeps) {
        responseData.services = serviceHealth;
        responseData.circuit_breakers = serviceBreakers.getStatus();
    }
    
    res.json(responseData);
});

// Reset circuit breakers endpoint
app.post('/reset-breakers', (req, res) => {
    serviceBreakers.breakers.forEach(breaker => {
        breaker.state = 'CLOSED';
        breaker.failureCount = 0;
        breaker.lastFailureTime = null;
    });
    res.json({ message: 'Circuit breakers reset', status: serviceBreakers.getStatus() });
});

// Configuration frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get current configuration
app.get('/api/config', (req, res) => {
    res.json({
        services,
        environment: process.env.NODE_ENV || 'development',
        port: port
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

// Chat endpoint (routes to AI service)
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message required' });
        }

        // Step 1: Search documents with user query directly
        let searchResults = [];
        try {
            const searchResponse = await serviceBreakers.callService('document', async () => {
                return axios.post(`${services.document}/search`, {
                    query: message,
                    top_k: 3
                });
            });
            searchResults = searchResponse.data.results?.map(r => r.text) || [];
        } catch (error) {
            console.warn('Document search failed:', error.message);
        }

        // Step 2: Generate response with Gemini first, fallback to Groq
        let aiResponse;
        try {
            // Try Gemini first
            aiResponse = await serviceBreakers.callService('ai', async () => {
                return axios.post(`${services.ai}/generate`, {
                    message: message,
                    context: searchResults,
                    type: 'chat',
                    service: 'gemini'
                });
            });
        } catch (geminiError) {
            console.warn('Gemini failed, trying Groq:', geminiError.message);
            try {
                // Fallback to Groq
                aiResponse = await serviceBreakers.callService('ai', async () => {
                    return axios.post(`${services.ai}/generate`, {
                        message: message,
                        context: searchResults,
                        type: 'chat',
                        service: 'groq'
                    });
                });
            } catch (groqError) {
                console.error('Both Gemini and Groq failed:', groqError.message);
                throw groqError;
            }
        }

        res.json({
            response: aiResponse.data.response,
            sources: searchResults.length > 0 ? ['document_search'] : ['ai_only'],
            processing_time: aiResponse.data.processing_time || 0,
            service_used: aiResponse.data.service_used
        });

    } catch (error) {
        console.error('Chat error: 2', error.message);
        res.status(500).json({ 
            error: 'Sorry, I encountered an error processing your question.',
            details: error.message 
        });
    }
});

// File upload endpoint (routes to document service with Socket.IO progress)
app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Emit progress events like the original app.js
        console.log('Emitting upload-progress: starting');
        io.emit('upload-progress', { stage: 'starting', message: 'Processing file...', percent: 0 });

        const fs = await import('fs');
        const fileData = fs.readFileSync(req.file.path, { encoding: 'base64' });
        
        console.log('Emitting upload-progress: uploading');
        io.emit('upload-progress', { stage: 'uploading', message: 'Uploading to document service...', percent: 50 });

        const form = new FormData();
        form.append('pdf', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: 'application/pdf'
        });

        const response = await serviceBreakers.callService('document', async () => {
            return axios.post(`${services.document}/upload`, form, {
                headers: {
                    ...form.getHeaders()
                }
            });
        });

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        console.log('Emitting upload-complete');
        io.emit('upload-complete', { success: true });
        res.json(response.data);

    } catch (error) {
        console.error('Upload error:', error.message);
        
        // Clean up temp file on error
        try {
            const fs = await import('fs');
            fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError.message);
        }
        
        console.log('Emitting upload-error');
        io.emit('upload-error', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to process document',
            details: error.message 
        });
    }
});

// WhatsApp webhook verification (routes to WhatsApp service)
app.get('/webhook/whatsapp', async (req, res) => {
    try {
        const response = await axios.get(`${services.whatsapp}/verify-webhook`, {
            params: req.query
        });
        res.send(response.data);
    } catch (error) {
        console.error('WhatsApp verification error:', error.message);
        res.status(500).send('WhatsApp service unavailable');
    }
});

// WhatsApp webhook handler (routes to WhatsApp service)
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const response = await axios.post(`${services.whatsapp}/webhook`, req.body, {
            headers: {
                'X-Hub-Signature-256': req.headers['x-hub-signature-256']
            }
        });
        res.status(200).send('OK');
    } catch (error) {
        console.error('WhatsApp webhook error:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// WhatsApp status endpoint
app.get('/whatsapp/status', async (req, res) => {
    try {
        const response = await axios.get(`${services.whatsapp}/status`);
        res.json(response.data);
    } catch (error) {
        console.error('WhatsApp status error:', error.message);
        res.status(500).json({ error: 'WhatsApp service unavailable' });
    }
});

// Send WhatsApp message endpoint
app.post('/whatsapp/send', async (req, res) => {
    try {
        const response = await axios.post(`${services.whatsapp}/send-message`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('WhatsApp send error:', error.message);
        res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected to Socket.IO:', socket.id);
    
    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
    });
});

server.listen(port, () => {
    console.log(`API Gateway running on port ${port}`);
    console.log(`Configuration UI: http://localhost:${port}`);
    console.log(`WhatsApp webhook URL: http://localhost:${port}/webhook/whatsapp`);
    console.log(`Socket.IO server running on port ${port}`);
    console.log('Service URLs:');
    Object.entries(services).forEach(([name, url]) => {
        console.log(`  ${name}: ${url}`);
    });
});