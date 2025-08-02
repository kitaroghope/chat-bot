import express from 'express';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Service URLs from environment variables
const services = {
    document: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3001',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3002',
    whatsapp: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003',
    web: process.env.WEB_SERVICE_URL || 'http://localhost:3004',
    database: process.env.DATABASE_SERVICE_URL || 'http://localhost:3005'
};

// Health check endpoint
app.get('/health', async (req, res) => {
    const serviceHealth = {};
    
    for (const [name, url] of Object.entries(services)) {
        try {
            const response = await axios.get(`${url}/health`, { timeout: 5000 });
            serviceHealth[name] = response.data.status || 'healthy';
        } catch (error) {
            serviceHealth[name] = 'unhealthy';
        }
    }
    
    res.json({
        status: 'healthy',
        services: serviceHealth,
        timestamp: new Date().toISOString()
    });
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

        // Step 1: Optimize query with AI service
        let searchQuery = message;
        try {
            const optimizeResponse = await axios.post(`${services.ai}/optimize-query`, {
                query: message,
                service: 'gemini'
            });
            searchQuery = optimizeResponse.data.optimized_query || message;
        } catch (error) {
            console.warn('Query optimization failed, using original query');
        }

        // Step 2: Search documents
        let searchResults = [];
        try {
            const searchResponse = await axios.post(`${services.document}/search`, {
                query: searchQuery,
                top_k: 3
            });
            searchResults = searchResponse.data.results?.map(r => r.text) || [];
        } catch (error) {
            console.warn('Document search failed');
        }

        // Step 3: Generate response
        const aiResponse = await axios.post(`${services.ai}/generate`, {
            message: message,
            context: searchResults,
            type: 'chat',
            service: 'gemini'
        });

        res.json({
            response: aiResponse.data.response,
            sources: searchResults.length > 0 ? ['document_search'] : ['ai_only'],
            processing_time: aiResponse.data.processing_time || 0
        });

    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ 
            error: 'Sorry, I encountered an error processing your question.',
            details: error.message 
        });
    }
});

// File upload endpoint (routes to document service)
app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fs = await import('fs');
        const fileData = fs.readFileSync(req.file.path, { encoding: 'base64' });
        
        const response = await axios.post(`${services.document}/process-document`, {
            file_data: fileData,
            filename: req.file.originalname
        });

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        res.json(response.data);

    } catch (error) {
        console.error('Upload error:', error.message);
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

app.listen(port, () => {
    console.log(`API Gateway running on port ${port}`);
    console.log(`Configuration UI: http://localhost:${port}`);
    console.log('Service URLs:');
    Object.entries(services).forEach(([name, url]) => {
        console.log(`  ${name}: ${url}`);
    });
});