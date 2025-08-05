import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import DatabaseClient from './utils/DatabaseClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3002;

// Database client
const db = new DatabaseClient();

// Initialize AI services
let groqService = null;
let geminiService = null;

// Initialize Groq
if (process.env.GROQ_API_KEY) {
    try {
        groqService = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
        console.log('Groq AI service initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Groq service:', error.message);
    }
}

// Initialize Gemini
if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        geminiService = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('Gemini AI service initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Gemini service:', error.message);
    }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', async (req, res) => {
    try {
        // Check database dependency
        let databaseStatus = 'unknown';
        try {
            const dbHealth = await db.checkHealth();
            databaseStatus = dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
        } catch (error) {
            databaseStatus = 'unhealthy';
        }

        const isHealthy = (groqService || geminiService) && databaseStatus === 'healthy';

        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'degraded',
            services: {
                groq: groqService ? 'active' : 'inactive',
                gemini: geminiService ? 'active' : 'inactive'
            },
            dependencies: {
                database: databaseStatus
            },
            models: {
                groq: process.env.GROQ_MODEL || 'llama3-8b-8192',
                gemini: 'gemini-1.5-flash'
            },
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
        groq_configured: !!process.env.GROQ_API_KEY,
        gemini_configured: !!process.env.GEMINI_API_KEY,
        groq_model: process.env.GROQ_MODEL || 'llama3-8b-8192',
        gemini_model: 'gemini-1.5-flash',
        default_service: process.env.DEFAULT_AI_SERVICE || 'gemini',
        max_tokens: parseInt(process.env.MAX_TOKENS) || 1024,
        temperature: parseFloat(process.env.TEMPERATURE) || 0.7
    });
});

// Utility function to extract text from Gemini response
function extractGeminiText(result) {
    try {
        return (
            result?.response?.text?.() ||
            result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
            ''
        ).trim();
    } catch {
        return '';
    }
}

// Generate response endpoint
app.post('/generate', async (req, res) => {
    try {
        const { 
            message, 
            context = [], 
            type = 'chat', 
            service = process.env.DEFAULT_AI_SERVICE || 'gemini',
            temperature = 0.7,
            max_tokens = 1024
        } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        let response;
        let serviceUsed;
        let processingTime = Date.now();

        if (service === 'groq' && groqService) {
            response = await generateGroqResponse(message, context, type, temperature, max_tokens);
            serviceUsed = 'groq';
        } else if (service === 'gemini' && geminiService) {
            response = await generateGeminiResponse(message, context, type, temperature, max_tokens);
            serviceUsed = 'gemini';
        } else {
            // Fallback to available service
            if (geminiService) {
                response = await generateGeminiResponse(message, context, type, temperature, max_tokens);
                serviceUsed = 'gemini';
            } else if (groqService) {
                response = await generateGroqResponse(message, context, type, temperature, max_tokens);
                serviceUsed = 'groq';
            } else {
                return res.status(503).json({ error: 'No AI services available' });
            }
        }

        processingTime = Date.now() - processingTime;

        // Log AI request to database
        try {
            await db.createAIRequest({
                service_type: serviceUsed,
                model_name: serviceUsed === 'groq' ? (process.env.GROQ_MODEL || 'llama3-8b-8192') : 'gemini-1.5-flash',
                prompt: message,
                response: response,
                tokens_used: response.length, // Approximate
                processing_time_ms: processingTime,
                status: 'completed',
                metadata: {
                    context_length: context.length,
                    type: type,
                    temperature: temperature,
                    max_tokens: max_tokens
                }
            });
        } catch (dbError) {
            console.error('Failed to log AI request to database:', dbError);
            // Continue with response even if logging fails
        }

        res.json({
            response: response,
            service_used: serviceUsed,
            processing_time: processingTime / 1000,
            tokens_used: response.length // Approximate
        });

    } catch (error) {
        console.error('Generate response error:', error);
        res.status(500).json({
            error: 'Failed to generate response',
            details: error.message
        });
    }
});

// Optimize query endpoint
app.post('/optimize-query', async (req, res) => {
    try {
        const { 
            query, 
            service = process.env.DEFAULT_AI_SERVICE || 'gemini' 
        } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'query is required' });
        }

        let optimizedQuery;
        let serviceUsed;
        let processingTime = Date.now();

        if (service === 'groq' && groqService) {
            optimizedQuery = await optimizeQueryGroq(query);
            serviceUsed = 'groq';
        } else if (service === 'gemini' && geminiService) {
            optimizedQuery = await optimizeQueryGemini(query);
            serviceUsed = 'gemini';
        } else {
            // Fallback to available service
            if (geminiService) {
                optimizedQuery = await optimizeQueryGemini(query);
                serviceUsed = 'gemini';
            } else if (groqService) {
                optimizedQuery = await optimizeQueryGroq(query);
                serviceUsed = 'groq';
            } else {
                return res.status(503).json({ error: 'No AI services available' });
            }
        }

        processingTime = (Date.now() - processingTime) / 1000;

        res.json({
            original_query: query,
            optimized_query: optimizedQuery || query,
            service_used: serviceUsed,
            processing_time: processingTime
        });

    } catch (error) {
        console.error('Optimize query error:', error);
        res.status(500).json({
            error: 'Failed to optimize query',
            details: error.message
        });
    }
});

// Generate WhatsApp response endpoint
app.post('/generate-whatsapp', async (req, res) => {
    try {
        const { 
            message, 
            context = [], 
            sender_name = '',
            service = 'groq' // Prefer Groq for WhatsApp
        } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        let response;
        let serviceUsed;
        let processingTime = Date.now();

        if (service === 'groq' && groqService) {
            response = await generateGroqWhatsAppResponse(message, context, sender_name);
            serviceUsed = 'groq';
        } else if (service === 'gemini' && geminiService) {
            response = await generateGeminiWhatsAppResponse(message, context, sender_name);
            serviceUsed = 'gemini';
        } else {
            // Fallback
            if (groqService) {
                response = await generateGroqWhatsAppResponse(message, context, sender_name);
                serviceUsed = 'groq';
            } else if (geminiService) {
                response = await generateGeminiWhatsAppResponse(message, context, sender_name);
                serviceUsed = 'gemini';
            } else {
                return res.status(503).json({ error: 'No AI services available' });
            }
        }

        processingTime = (Date.now() - processingTime) / 1000;

        res.json({
            response: response,
            service_used: serviceUsed,
            processing_time: processingTime,
            character_count: response.length
        });

    } catch (error) {
        console.error('Generate WhatsApp response error:', error);
        res.status(500).json({
            error: 'Failed to generate WhatsApp response',
            details: error.message
        });
    }
});

// Groq response generation functions
async function generateGroqResponse(message, context, type, temperature, maxTokens) {
    let systemPrompt = `You are a helpful AI assistant. Respond in a conversational, friendly manner.`;
    
    if (type === 'whatsapp') {
        systemPrompt = `You are a helpful WhatsApp assistant. Respond in a conversational, friendly manner. Keep responses concise and relevant for mobile messaging.`;
    }
    
    if (context && context.length > 0) {
        systemPrompt += `\n\nContext from documents:\n${context.join('\n\n')}`;
    }

    const completion = await groqService.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ],
        model: process.env.GROQ_MODEL || 'llama3-8b-8192',
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: 1,
        stream: false,
        stop: null
    });

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
}

async function optimizeQueryGroq(query) {
    const completion = await groqService.chat.completions.create({
        messages: [
            {
                role: "system",
                content: "You are a query optimization assistant. Transform the user's question into a better search query by extracting key terms and concepts. Return only the optimized query, nothing else."
            },
            { role: "user", content: query }
        ],
        model: process.env.GROQ_MODEL || 'llama3-8b-8192',
        temperature: 0.3,
        max_tokens: 100,
        top_p: 1,
        stream: false,
        stop: null
    });

    return completion.choices[0]?.message?.content || query;
}

async function generateGroqWhatsAppResponse(message, context, senderName) {
    const greeting = senderName ? `Hi ${senderName}! ` : 'Hi! ';
    
    let systemPrompt = `You are a helpful WhatsApp bot assistant. Respond naturally and conversationally. Keep responses under 500 characters when possible. Use emojis appropriately. Be friendly and helpful.`;
    
    if (context && context.length > 0) {
        systemPrompt += `\n\nContext from documents:\n${context.join('\n\n')}`;
    }

    const completion = await groqService.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ],
        model: process.env.GROQ_MODEL || 'llama3-8b-8192',
        temperature: 0.8,
        max_tokens: 300,
        top_p: 1,
        stream: false,
        stop: null
    });

    let response = completion.choices[0]?.message?.content || "I'm here to help! 😊";
    
    // Add greeting for first-time interactions
    if (senderName && (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi'))) {
        if (!response.toLowerCase().startsWith('hi')) {
            response = greeting + response;
        }
    }

    return response;
}

// Gemini response generation functions
async function generateGeminiResponse(message, context, type, temperature, maxTokens) {
    let prompt = `You are a helpful AI assistant answering questions based on document content.

User's question: "${message}"`;

    if (context && context.length > 0) {
        prompt += `

Relevant document excerpts:
${context.join('\n\n---\n\n')}

Instructions:
1. Answer the user's question using ONLY the information provided in the document excerpts.
2. DO NOT use external knowledge unless explicitly present in the excerpts.
3. Write in a natural, conversational tone as if you're a knowledgeable person explaining the topic.
4. If the information is insufficient, say clearly: "The provided documents don't contain enough information to answer this fully."
5. Use specific details and quotes from the excerpts when relevant.
6. Structure your response clearly with proper formatting.
7. Be concise but comprehensive.`;
    }

    prompt += `

Response:`;

    const result = await geminiService.generateContent(prompt);
    const response = extractGeminiText(result);

    return response || "I couldn't find relevant information to answer that question.";
}

async function optimizeQueryGemini(query) {
    const prompt = `You are a search query optimizer. Given a user's question, create an optimized search query that will find the most relevant information in a document database.

User question: "${query}"

Instructions:
1. Extract the key concepts and terms
2. Consider synonyms and related terms
3. Make the query more specific and targeted
4. Return only the optimized search query, nothing else

Optimized search query:`;

    const result = await geminiService.generateContent(prompt);
    const optimized = extractGeminiText(result);

    return optimized || query;
}

async function generateGeminiWhatsAppResponse(message, context, senderName) {
    let prompt = `You are a helpful WhatsApp bot assistant. Respond naturally and conversationally based on the provided document context. Keep responses under 500 characters when possible. Use emojis appropriately. Be friendly and helpful.

User's message: "${message}"`;

    if (context && context.length > 0) {
        prompt += `

Context from documents:
${context.join('\n\n')}`;
    }

    prompt += `

Response:`;

    const result = await geminiService.generateContent(prompt);
    let response = extractGeminiText(result) || "I'm here to help! 😊";

    // Add greeting for first-time interactions
    if (senderName && (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi'))) {
        const greeting = `Hi ${senderName}! `;
        if (!response.toLowerCase().startsWith('hi')) {
            response = greeting + response;
        }
    }

    return response;
}

// Test endpoint (simplified to avoid self-referential calls)
app.post('/test', async (req, res) => {
    try {
        const { service = 'gemini', message = 'Hello, how are you?' } = req.body;
        
        // Test services directly instead of making HTTP call to self
        let response;
        if (service === 'groq' && groqService) {
            response = await generateGroqResponse(message, [], 'chat', 0.7, 100);
        } else if (service === 'gemini' && geminiService) {
            response = await generateGeminiResponse(message, [], 'chat', 0.7, 100);
        } else {
            return res.status(503).json({ error: 'Requested service not available' });
        }
        
        res.json({
            response: response,
            service_used: service,
            test: true
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Test failed',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`AI service running on port ${port}`);
    console.log(`Configuration UI: http://localhost:${port}`);
    console.log('Available services:');
    console.log(`  Groq: ${groqService ? 'Active' : 'Inactive'}`);
    console.log(`  Gemini: ${geminiService ? 'Active' : 'Inactive'}`);
});