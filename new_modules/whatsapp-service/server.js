import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import DatabaseClient from './utils/DatabaseClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3003;

// Database client
const db = new DatabaseClient();

// Function to update .env file
async function updateEnvFile(updates) {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    try {
        // Read existing .env file or use .env.example as template
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        } else {
            const examplePath = path.join(__dirname, '.env.example');
            if (fs.existsSync(examplePath)) {
                envContent = fs.readFileSync(examplePath, 'utf8');
            }
        }
        
        // Update or add environment variables
        for (const [key, value] of Object.entries(updates)) {
            if (value) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                const newLine = `${key}=${value}`;
                
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, newLine);
                } else {
                    envContent += `\n${newLine}`;
                }
            }
        }
        
        // Write updated content back to .env file
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log('✅ WhatsApp service .env file updated successfully');
        
    } catch (error) {
        console.error('❌ Failed to update .env file:', error);
        throw error;
    }
}

let aiServiceStatus = 'unknown';
let documentServiceStatus = 'unknown';

// WhatsApp configuration
const whatsappConfig = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
    baseUrl: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v18.0'}`
};

// Service URLs
const services = {
    ai: process.env.AI_SERVICE_URL || 'https://chat-bot-02-pony.onrender.com',
    document: process.env.DOCUMENT_SERVICE_URL || 'https://chat-bot-01.onrender.com'
};

// Message statistics
let messageStats = {
    sent: 0,
    received: 0,
    errors: 0,
    lastActivity: null
};

// Middleware
app.use(cors());
app.use(express.json({ 
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const checkDeps = req.query.deps !== 'false';
        
        if (checkDeps) {
            // Check AI service dependency
            try {
                const response = await axios.get(`${services.ai}/health?deps=false`, { timeout: 5000 });
                aiServiceStatus = response.data.status === 'healthy' ? 'healthy' : 'unhealthy';
            } catch (error) {
                aiServiceStatus = 'unhealthy';
            }

            // Check document service dependency
            try {
                const response = await axios.get(`${services.document}/health?deps=false`, { timeout: 5000 });
                documentServiceStatus = response.data.status === 'healthy' ? 'healthy' : 'unhealthy';
            } catch (error) {
                documentServiceStatus = 'unhealthy';
            }
        }

        const whatsappConfigured = !!(whatsappConfig.accessToken && whatsappConfig.verifyToken && whatsappConfig.phoneNumberId);
        const isHealthy = whatsappConfigured && (!checkDeps || aiServiceStatus === 'healthy');

        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'degraded',
            whatsapp_api: whatsappConfig.accessToken ? 'configured' : 'not_configured',
            webhook_verified: !!whatsappConfig.verifyToken,
            phone_number_id: whatsappConfig.phoneNumberId || 'not_set',
            api_version: whatsappConfig.apiVersion,
            dependencies: {
                ai_service: aiServiceStatus,
                document_service: documentServiceStatus
            },
            message_stats: messageStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get configuration
app.get('/api/config', (req, res) => {
    res.json({
        access_token_configured: !!whatsappConfig.accessToken,
        verify_token_configured: !!whatsappConfig.verifyToken,
        app_secret_configured: !!whatsappConfig.appSecret,
        phone_number_id_configured: !!whatsappConfig.phoneNumberId,
        api_version: whatsappConfig.apiVersion,
        ai_service_url: services.ai,
        document_service_url: services.document,
        webhook_url: `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3003'}/webhook`,
        message_stats: messageStats
    });
});

// Update configuration
app.post('/api/config', async (req, res) => {
    try {
        const { 
            access_token, 
            verify_token, 
            app_secret, 
            phone_number_id,
            ai_service_url,
            document_service_url 
        } = req.body;

        // Update in-memory configuration
        if (access_token) {
            whatsappConfig.accessToken = access_token;
            process.env.WHATSAPP_ACCESS_TOKEN = access_token;
        }
        if (verify_token) {
            whatsappConfig.verifyToken = verify_token;
            process.env.WHATSAPP_VERIFY_TOKEN = verify_token;
        }
        if (app_secret) {
            whatsappConfig.appSecret = app_secret;
            process.env.WHATSAPP_APP_SECRET = app_secret;
        }
        if (phone_number_id) {
            whatsappConfig.phoneNumberId = phone_number_id;
            process.env.WHATSAPP_PHONE_NUMBER_ID = phone_number_id;
        }
        if (ai_service_url) {
            services.ai = ai_service_url;
            process.env.AI_SERVICE_URL = ai_service_url;
        }
        if (document_service_url) {
            services.document = document_service_url;
            process.env.DOCUMENT_SERVICE_URL = document_service_url;
        }

        // Update .env file for persistence
        await updateEnvFile({
            WHATSAPP_ACCESS_TOKEN: access_token || process.env.WHATSAPP_ACCESS_TOKEN,
            WHATSAPP_VERIFY_TOKEN: verify_token || process.env.WHATSAPP_VERIFY_TOKEN,
            WHATSAPP_APP_SECRET: app_secret || process.env.WHATSAPP_APP_SECRET,
            WHATSAPP_PHONE_NUMBER_ID: phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID,
            AI_SERVICE_URL: ai_service_url || process.env.AI_SERVICE_URL,
            DOCUMENT_SERVICE_URL: document_service_url || process.env.DOCUMENT_SERVICE_URL
        });

        res.json({
            success: true,
            message: 'Configuration updated successfully and persisted to .env file',
            configuration: {
                access_token_configured: !!whatsappConfig.accessToken,
                verify_token_configured: !!whatsappConfig.verifyToken,
                app_secret_configured: !!whatsappConfig.appSecret,
                phone_number_id_configured: !!whatsappConfig.phoneNumberId,
                ai_service_url: services.ai,
                document_service_url: services.document
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to save configuration',
            details: error.message
        });
    }
});

// Verify webhook signature
function verifyWebhookSignature(payload, signature) {
    if (!whatsappConfig.appSecret || !signature) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', whatsappConfig.appSecret)
        .update(payload, 'utf8')
        .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
    );
}

// WhatsApp webhook verification (GET) - matches app.js format
app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('Webhook verification failed');
        res.status(403).send('Forbidden');
    }
});

// Keep the old endpoint for backward compatibility
app.get('/verify-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('Webhook verification failed');
        res.status(403).send('Forbidden');
    }
});

// WhatsApp webhook handler (POST) - matches app.js format
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        // Verify webhook signature for security
        const signature = req.headers['x-hub-signature-256'];
        if (whatsappConfig.appSecret && !verifyWebhookSignature(req.rawBody, signature)) {
            console.log('Invalid webhook signature');
            return res.status(403).send('Forbidden');
        }

        // Process the webhook message
        await processWebhookMessage(req.body);
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('Error processing WhatsApp webhook:', error);
        messageStats.errors++;
        res.status(500).send('Internal Server Error');
    }
});

// Keep the old endpoint for backward compatibility
app.post('/webhook', async (req, res) => {
    try {
        // Verify webhook signature for security
        const signature = req.headers['x-hub-signature-256'];
        if (whatsappConfig.appSecret && !verifyWebhookSignature(req.rawBody, signature)) {
            console.log('Invalid webhook signature');
            return res.status(403).send('Forbidden');
        }

        // Process the webhook message
        await processWebhookMessage(req.body);
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('Error processing WhatsApp webhook:', error);
        messageStats.errors++;
        res.status(500).send('Internal Server Error');
    }
});

// Process incoming webhook message
async function processWebhookMessage(webhookData) {
    try {
        const entry = webhookData.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value?.messages) {
            console.log('No messages in webhook data');
            return;
        }

        for (const message of value.messages) {
            const from = message.from;
            const messageId = message.id;
            const messageType = message.type;

            messageStats.received++;
            messageStats.lastActivity = new Date().toISOString();

            // Mark message as read (non-critical operation)
            try {
                await markAsRead(messageId);
            } catch (error) {
                console.warn('Failed to mark message as read:', error.message);
            }

            // Get sender info
            const contact = value.contacts?.find(c => c.wa_id === from);
            const senderName = contact?.profile?.name || '';

            let responseMessage = '';

            if (messageType === 'text') {
                const userMessage = message.text.body;
                console.log(`Received message from ${from} (${senderName}): ${userMessage}`);

                // Generate AI response with document search
                responseMessage = await generateEnhancedResponse(userMessage, senderName);

                // Send response
                try {
                    await sendMessage(from, responseMessage);
                    messageStats.sent++;
                } catch (error) {
                    console.error(`Failed to send response to ${from}:`, error.message);
                    messageStats.errors++;
                }
            } else {
                // Handle other message types
                responseMessage = `Hi ${senderName}! I received your ${messageType} message. Currently, I can only respond to text messages. 📱`;
                try {
                    await sendMessage(from, responseMessage);
                    messageStats.sent++;
                } catch (error) {
                    console.error(`Failed to send response to ${from}:`, error.message);
                    messageStats.errors++;
                }
            }
        }
    } catch (error) {
        console.error('Error processing webhook message:', error);
        messageStats.errors++;
    }
}

// Generate enhanced AI response with document search
async function generateEnhancedResponse(userMessage, senderName = '') {
    try {
        // Step 1: Search documents with user query directly
        let searchResults = [];
        try {
            const searchResponse = await axios.post(`${services.document}/search`, {
                query: userMessage,
                top_k: 3,
                threshold: 0.7
            });
            searchResults = searchResponse.data.results?.map(r => r.text) || [];
        } catch (error) {
            console.warn('Document search failed');
        }

        // Step 2: Generate WhatsApp response with Gemini first, fallback to Groq
        let responseMessage;
        try {
            // Try Gemini first
            const aiResponse = await axios.post(`${services.ai}/generate-whatsapp`, {
                message: userMessage,
                context: searchResults,
                sender_name: senderName,
                service: 'gemini'
            });
            responseMessage = aiResponse.data.response;
        } catch (geminiError) {
            console.warn('Gemini failed, trying Groq for WhatsApp:', geminiError.message);
            try {
                // Fallback to Groq
                const aiResponse = await axios.post(`${services.ai}/generate-whatsapp`, {
                    message: userMessage,
                    context: searchResults,
                    sender_name: senderName,
                    service: 'groq'
                });
                responseMessage = aiResponse.data.response;
            } catch (error) {
                console.warn('AI response generation failed, using fallback');
                
                if (searchResults.length > 0) {
                    const greeting = senderName ? `Hi ${senderName}! ` : 'Hi! ';
                    responseMessage = greeting + "Based on the documents, here's what I found:\n\n" + 
                        searchResults.slice(0, 2).join('\n\n').substring(0, 800) + "...";
                } else {
                    responseMessage = senderName ? 
                        `Hi ${senderName}! I received your message but couldn't find relevant information. Please try rephrasing your question! 😊` :
                        "Hi! I received your message but couldn't find relevant information. Please try rephrasing your question! 😊";
                }
            }
        }

        // Ensure response is suitable for WhatsApp (not too long)
        if (responseMessage.length > 1000) {
            responseMessage = responseMessage.substring(0, 950) + "... 📄\n\nWould you like me to provide more details?";
        }

        return responseMessage;

    } catch (error) {
        console.error('Error generating enhanced WhatsApp response:', error);
        const greeting = senderName ? `Hi ${senderName}! ` : 'Hi! ';
        return greeting + "Sorry, I'm having trouble processing your message right now. Please try again! 🤖";
    }
}

// Send WhatsApp message
async function sendMessage(to, message) {
    if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
        throw new Error('WhatsApp credentials not configured');
    }

    const url = `${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/messages`;
    
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
            body: message
        }
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        const errorData = error.response?.data?.error;
        if (errorData?.code === 190) {
            console.error('WhatsApp access token expired. Please refresh your token.');
            throw new Error('WhatsApp access token expired. Please refresh your token.');
        } else {
            console.error('Error sending message:', error.response?.data || error.message);
            throw error;
        }
    }
}

// Mark message as read
async function markAsRead(messageId) {
    if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
        return null;
    }

    const url = `${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/messages`;
    
    const data = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error marking message as read:', error.response?.data || error.message);
        return null;
    }
}

// Send message endpoint (for testing)
app.post('/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'Phone number and message are required' });
        }

        const result = await sendMessage(to, message);
        messageStats.sent++;
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        messageStats.errors++;
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

// WhatsApp Status Endpoint (matches app.js format)
app.get('/whatsapp/status', (req, res) => {
    res.json({
        configured: !!(whatsappConfig.accessToken && whatsappConfig.verifyToken && whatsappConfig.phoneNumberId),
        access_token_valid: !!whatsappConfig.accessToken,
        webhook_verified: !!whatsappConfig.verifyToken,
        messages_sent_today: messageStats.sent,
        messages_received_today: messageStats.received,
        error_count: messageStats.errors,
        last_activity: messageStats.lastActivity,
        api_version: whatsappConfig.apiVersion
    });
});

// Send WhatsApp Message Endpoint (matches app.js format)
app.post('/whatsapp/send', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'Phone number and message are required' });
        }

        const result = await sendMessage(to, message);
        messageStats.sent++;
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        messageStats.errors++;
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

// Get status endpoint (backward compatibility)
app.get('/status', (req, res) => {
    res.json({
        configured: !!(whatsappConfig.accessToken && whatsappConfig.verifyToken && whatsappConfig.phoneNumberId),
        access_token_valid: !!whatsappConfig.accessToken,
        webhook_verified: !!whatsappConfig.verifyToken,
        messages_sent_today: messageStats.sent,
        messages_received_today: messageStats.received,
        error_count: messageStats.errors,
        last_activity: messageStats.lastActivity,
        api_version: whatsappConfig.apiVersion
    });
});

// Send template message endpoint
app.post('/send-template', async (req, res) => {
    try {
        const { to, templateName, languageCode = 'en_US', parameters = [] } = req.body;
        
        if (!to || !templateName) {
            return res.status(400).json({ error: 'Phone number and template name are required' });
        }

        const result = await sendTemplateMessage(to, templateName, languageCode, parameters);
        messageStats.sent++;
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Error sending template message:', error);
        messageStats.errors++;
        res.status(500).json({ error: 'Failed to send template message', details: error.message });
    }
});

// Send template message
async function sendTemplateMessage(to, templateName, languageCode = 'en_US', parameters = []) {
    if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
        throw new Error('WhatsApp credentials not configured');
    }

    const url = `${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/messages`;
    
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: languageCode
            },
            components: parameters.length > 0 ? [{
                type: 'body',
                parameters: parameters.map(param => ({
                    type: 'text',
                    text: param
                }))
            }] : []
        }
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Template message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending template message:', error.response?.data || error.message);
        throw error;
    }
}

// Test webhook endpoint
app.post('/test-webhook', (req, res) => {
    console.log('Test webhook received:', JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: 'Test webhook received' });
});

// Request verification code endpoint
app.post('/request-verification-code', async (req, res) => {
    try {
        const { code_method = 'SMS', language = 'en' } = req.body;
        
        if (!['SMS', 'VOICE'].includes(code_method)) {
            return res.status(400).json({ 
                error: 'Invalid code_method',
                message: 'code_method must be either SMS or VOICE'
            });
        }

        if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
            return res.status(400).json({ 
                error: 'WhatsApp not configured',
                message: 'WhatsApp access token and phone number ID must be configured'
            });
        }

        const url = `${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/request_code`;
        
        const data = {
            code_method: code_method,
            language: language
        };

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Verification code request successful:', response.data);
        
        res.json({
            success: true,
            message: 'Verification code requested successfully',
            code_method: code_method,
            language: language,
            data: response.data
        });

    } catch (error) {
        console.error('Error requesting verification code:', error.response?.data || error.message);
        
        const errorData = error.response?.data?.error;
        res.status(error.response?.status || 500).json({
            error: 'Failed to request verification code',
            message: errorData?.message || error.message,
            details: errorData
        });
    }
});

// Verify number with code endpoint
app.post('/verify-number', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ 
                error: 'code is required',
                message: 'Please provide the verification code in the request body'
            });
        }

        if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
            return res.status(400).json({ 
                error: 'WhatsApp not configured',
                message: 'WhatsApp access token and phone number ID must be configured'
            });
        }

        const url = `${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/verify_code`;
        
        const data = {
            code: code
        };

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Number verification successful:', response.data);
        
        res.json({
            success: true,
            message: 'Number verified successfully',
            data: response.data
        });

    } catch (error) {
        console.error('Error verifying number:', error.response?.data || error.message);
        
        const errorData = error.response?.data?.error;
        res.status(error.response?.status || 500).json({
            error: 'Failed to verify number',
            message: errorData?.message || error.message,
            details: errorData
        });
    }
});

// Register phone number endpoint (Cloud API)
app.post('/register-number', async (req, res) => {
    try {
        const { pin } = req.body;
        
        if (!pin) {
            return res.status(400).json({ 
                error: 'pin is required',
                message: 'Please provide a 6-digit two-step verification PIN in the request body'
            });
        }

        if (!/^\d{6}$/.test(pin)) {
            return res.status(400).json({ 
                error: 'Invalid PIN format',
                message: 'PIN must be exactly 6 digits'
            });
        }

        if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
            return res.status(400).json({ 
                error: 'WhatsApp not configured',
                message: 'WhatsApp access token and phone number ID must be configured'
            });
        }

        const url = `${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/register`;
        
        const data = {
            pin: pin
        };

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Number registration successful:', response.data);
        
        res.json({
            success: true,
            message: 'Number registered successfully',
            data: response.data
        });

    } catch (error) {
        console.error('Error registering number:', error.response?.data || error.message);
        
        const errorData = error.response?.data?.error;
        res.status(error.response?.status || 500).json({
            error: 'Failed to register number',
            message: errorData?.message || error.message,
            details: errorData
        });
    }
});

// On-Premises API: Request registration code with certificate
app.post('/regcode', async (req, res) => {
    try {
        const { cc, phone_number, method = 'sms', cert, pin } = req.body;
        
        if (!cc || !phone_number || !cert) {
            return res.status(400).json({ 
                error: 'Missing required parameters',
                message: 'cc (country code), phone_number, and cert (base64 certificate) are required'
            });
        }

        if (!['sms', 'voice'].includes(method)) {
            return res.status(400).json({ 
                error: 'Invalid method',
                message: 'method must be either "sms" or "voice"'
            });
        }

        if (pin && !/^\d{6}$/.test(pin)) {
            return res.status(400).json({ 
                error: 'Invalid PIN format',
                message: 'PIN must be exactly 6 digits if provided'
            });
        }

        const onPremisesUrl = process.env.WHATSAPP_ON_PREMISES_URL || whatsappConfig.baseUrl;
        if (!onPremisesUrl) {
            return res.status(400).json({ 
                error: 'On-Premises API not configured',
                message: 'WHATSAPP_ON_PREMISES_URL environment variable must be set'
            });
        }

        const url = `${onPremisesUrl}/v1/account`;
        
        const data = {
            cc: cc,
            phone_number: phone_number,
            method: method,
            cert: cert
        };

        if (pin) {
            data.pin = pin;
        }

        const response = await axios.post(url, data, {
            auth: {
                username: 'admin',
                password: process.env.WHATSAPP_ON_PREMISES_PASSWORD || ''
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Registration code request successful:', response.data);
        
        res.json({
            success: true,
            message: 'Registration code requested successfully (On-Premises API)',
            method: method,
            data: response.data
        });

    } catch (error) {
        console.error('Error requesting registration code (On-Premises):', error.response?.data || error.message);
        
        const errorData = error.response?.data;
        res.status(error.response?.status || 500).json({
            error: 'Failed to request registration code',
            message: errorData?.message || error.message,
            details: errorData,
            note: 'On-Premises API is being sunset. Consider migrating to Cloud API.'
        });
    }
});

// Reset statistics
app.post('/reset-stats', (req, res) => {
    messageStats = {
        sent: 0,
        received: 0,
        errors: 0,
        lastActivity: null
    };
    res.json({ success: true, message: 'Statistics reset' });
});

app.listen(port, () => {
    console.log(`WhatsApp service running on port ${port}`);
    console.log(`Configuration UI: http://localhost:${port}`);
    console.log(`Webhook URL: http://localhost:${port}/webhook`);
    console.log('WhatsApp configuration:');
    console.log(`  Access Token: ${whatsappConfig.accessToken ? 'Configured' : 'Not configured'}`);
    console.log(`  Verify Token: ${whatsappConfig.verifyToken ? 'Configured' : 'Not configured'}`);
    console.log(`  Phone Number ID: ${whatsappConfig.phoneNumberId || 'Not configured'}`);
});