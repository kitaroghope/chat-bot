import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { addDocument, findSimilar } from './searcher.js';
import GeminiService from './gemini.js';
import WhatsAppService from './whatsapp.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server);
const port = 3007;
const upload = multer({ dest: "uploads/" });

// Initialize Gemini service
let geminiService;
try {
    geminiService = new GeminiService();
    console.log('Gemini AI service initialized successfully');
} catch (error) {
    console.error('Failed to initialize Gemini service:', error.message);
    console.log('Chat will work with basic vector search only');
}

// Initialize WhatsApp service
let whatsappService;
try {
    whatsappService = new WhatsAppService();
    console.log('WhatsApp service initialized successfully');
    console.log('WhatsApp status:', whatsappService.getStatus());
} catch (error) {
    console.error('Failed to initialize WhatsApp service:', error.message);
    console.log('WhatsApp webhook will not be available');
}

app.use(express.json({ verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
}}));
app.use(express.static("public"));

app.post("/upload", upload.single("pdf"), async (req, res) => {
    const filePath = req.file.path;
    
    try {
        await addDocument(filePath, (progress) => {
            io.emit('upload-progress', progress);
        });
        fs.unlinkSync(filePath); // clean up temp file
        io.emit('upload-complete', { success: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Upload error:', error);
        fs.unlinkSync(filePath); // clean up temp file
        io.emit('upload-error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

app.post("/chat", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).send({ error: "Message required" });

    try {
        let searchQuery = message;
        
        // Step 1: Optimize query with Gemini (if available)
        if (geminiService) {
            console.log(`Original query: ${message}`);
            searchQuery = await geminiService.optimizeQuery(message);
            console.log(`Optimized query: ${searchQuery}`);
        }

        // Step 2: Vector search with optimized query
        const results = await findSimilar(searchQuery);
        
        if (results.length === 0) {
            return res.send({ 
                response: "I couldn't find any relevant information in the uploaded documents to answer your question." 
            });
        }

        // Step 3: Generate human-like response with Gemini (if available)
        let response;
        if (geminiService) {
            response = await geminiService.generateResponse(message, results);
        } else {
            // Fallback to basic concatenation
            response = results.join("\n\n");
        }

        res.send({ response });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).send({ error: "Sorry, I encountered an error processing your question." });
    }
});

// WhatsApp Webhook Verification (GET)
app.get('/webhook/whatsapp', (req, res) => {
    if (!whatsappService) {
        return res.status(500).send('WhatsApp service not initialized');
    }

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('Webhook verification request:', { mode, token, challenge });

    const verificationResult = whatsappService.verifyWebhook(mode, token, challenge);
    
    if (verificationResult) {
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Forbidden');
    }
});

// WhatsApp Webhook Handler (POST)
app.post('/webhook/whatsapp', async (req, res) => {
    if (!whatsappService) {
        return res.status(500).send('WhatsApp service not initialized');
    }

    // Verify webhook signature for security
    const signature = req.headers['x-hub-signature-256'];
    if (process.env.WHATSAPP_APP_SECRET && !whatsappService.verifyWebhookSignature(req.rawBody, signature)) {
        console.log('Invalid webhook signature');
        return res.status(403).send('Forbidden');
    }

    try {
        // Process the webhook message
        await whatsappService.processWebhookMessage(req.body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing WhatsApp webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// WhatsApp Status Endpoint
app.get('/whatsapp/status', (req, res) => {
    if (!whatsappService) {
        return res.status(500).json({ error: 'WhatsApp service not initialized' });
    }

    res.json(whatsappService.getStatus());
});

// Send WhatsApp Message Endpoint (for testing)
app.post('/whatsapp/send', async (req, res) => {
    if (!whatsappService) {
        return res.status(500).json({ error: 'WhatsApp service not initialized' });
    }

    const { to, message } = req.body;
    
    if (!to || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
    }

    try {
        const result = await whatsappService.sendMessage(to, message);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

server.listen(port, () => {
  console.log(`Chatbot server running at http://localhost:${port}`);
  console.log(`WhatsApp webhook URL: http://localhost:${port}/webhook/whatsapp`);
});