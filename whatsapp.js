import axios from 'axios';
import crypto from 'crypto';
import GroqService from './groq.js';
import { findSimilar } from './searcher.js';
import GeminiService from './gemini.js';

// hi

class WhatsAppService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
        this.appSecret = process.env.WHATSAPP_APP_SECRET;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        
        // Initialize Groq service
        try {
            this.groqService = new GroqService();
            console.log('Groq AI service initialized for WhatsApp');
        } catch (error) {
            console.error('Failed to initialize Groq service:', error.message);
            this.groqService = null;
        }
        
        // Initialize Gemini service for enhanced responses
        try {
            this.geminiService = new GeminiService();
            console.log('Gemini AI service initialized for WhatsApp');
        } catch (error) {
            console.error('Failed to initialize Gemini service for WhatsApp:', error.message);
            this.geminiService = null;
        }
        
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    }

    /**
     * Verify webhook signature for security
     * @param {string} payload - Request payload
     * @param {string} signature - X-Hub-Signature-256 header
     * @returns {boolean} - Whether signature is valid
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.appSecret || !signature) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.appSecret)
            .update(payload, 'utf8')
            .digest('hex');

        const receivedSignature = signature.replace('sha256=', '');
        
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(receivedSignature, 'hex')
        );
    }

    /**
     * Verify webhook during setup
     * @param {string} mode - hub.mode parameter
     * @param {string} token - hub.verify_token parameter
     * @param {string} challenge - hub.challenge parameter
     * @returns {string|null} - Challenge if verification succeeds, null otherwise
     */
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.verifyToken) {
            console.log('Webhook verified successfully');
            return challenge;
        }
        console.log('Webhook verification failed');
        return null;
    }

    /**
     * Send a text message via WhatsApp API
     * @param {string} to - Recipient phone number
     * @param {string} message - Message text
     * @returns {Promise<Object>} - API response
     */
    async sendMessage(to, message) {
        if (!this.accessToken || !this.phoneNumberId) {
            throw new Error('WhatsApp credentials not configured');
        }

        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        
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
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Message sent successfully:', response.data);
            return response.data;
        } catch (error) {
            const errorData = error.response?.data?.error;
            if (errorData?.code === 190) {
                console.error('WhatsApp access token expired. Please refresh your token.');
                console.error('Error details:', errorData.message);
                throw new Error('WhatsApp access token expired. Please refresh your token in the environment variables.');
            } else {
                console.error('Error sending message:', error.response?.data || error.message);
                throw error;
            }
        }
    }

    /**
     * Send a template message
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name
     * @param {string} languageCode - Language code (e.g., 'en_US')
     * @param {Array} parameters - Template parameters
     * @returns {Promise<Object>} - API response
     */
    async sendTemplateMessage(to, templateName, languageCode = 'en_US', parameters = []) {
        if (!this.accessToken || !this.phoneNumberId) {
            throw new Error('WhatsApp credentials not configured');
        }

        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        
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
                    'Authorization': `Bearer ${this.accessToken}`,
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

    /**
     * Mark message as read
     * @param {string} messageId - Message ID to mark as read
     * @returns {Promise<Object>} - API response
     */
    async markAsRead(messageId) {
        if (!this.accessToken || !this.phoneNumberId) {
            console.warn('WhatsApp credentials not configured, skipping mark as read');
            return null;
        }

        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        
        const data = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };

        try {
            const response = await axios.post(url, data, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            const errorData = error.response?.data?.error;
            if (errorData?.code === 190) {
                console.error('WhatsApp access token expired. Please refresh your token.');
                console.error('Error details:', errorData.message);
            } else {
                console.error('Error marking message as read:', error.response?.data || error.message);
            }
            // Don't throw error for mark as read failures - it's not critical
            return null;
        }
    }

    /**
     * Process incoming webhook message
     * @param {Object} webhookData - Webhook payload
     * @returns {Promise<void>}
     */
    async processWebhookMessage(webhookData) {
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

                // Mark message as read (non-critical operation)
                try {
                    await this.markAsRead(messageId);
                } catch (error) {
                    console.warn('Failed to mark message as read, continuing with response:', error.message);
                }

                // Get sender info
                const contact = value.contacts?.find(c => c.wa_id === from);
                const senderName = contact?.profile?.name || '';

                let responseMessage = '';

                if (messageType === 'text') {
                    const userMessage = message.text.body;
                    console.log(`Received message from ${from} (${senderName}): ${userMessage}`);

                    // Generate enhanced AI response with document search
                    responseMessage = await this.generateEnhancedResponse(userMessage, senderName);

                    // Send response
                    try {
                        await this.sendMessage(from, responseMessage);
                    } catch (error) {
                        console.error(`Failed to send response to ${from}:`, error.message);
                        // If token is expired, log helpful message
                        if (error.message.includes('expired')) {
                            console.error('Please update your WhatsApp access token in the .env file');
                        }
                    }
                } else {
                    // Handle other message types
                    responseMessage = `Hi ${senderName}! I received your ${messageType} message. Currently, I can only respond to text messages. 📱`;
                    try {
                        await this.sendMessage(from, responseMessage);
                    } catch (error) {
                        console.error(`Failed to send response to ${from}:`, error.message);
                        if (error.message.includes('expired')) {
                            console.error('Please update your WhatsApp access token in the .env file');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error processing webhook message:', error);
        }
    }

    /**
     * Generate enhanced AI response with document search integration
     * @param {string} userMessage - User's message
     * @param {string} senderName - Sender's name
     * @returns {Promise<string>} - Enhanced AI response
     */
    async generateEnhancedResponse(userMessage, senderName = '') {
        try {
            let searchQuery = userMessage;
            
            // Step 1: Optimize query with Gemini (if available)
            if (this.geminiService) {
                console.log(`Original WhatsApp query: ${userMessage}`);
                searchQuery = await this.geminiService.optimizeQuery(userMessage);
                console.log(`Optimized WhatsApp query: ${searchQuery}`);
            }

            // Step 2: Vector search with optimized query
            const results = await findSimilar(searchQuery);
            
            let responseMessage;
            
            if (results.length === 0) {
                // No relevant documents found, use basic AI response
                if (this.groqService) {
                    responseMessage = await this.groqService.generateWhatsAppResponse(userMessage, senderName);
                } else {
                    responseMessage = `Hi ${senderName}! I received your message but couldn't find relevant information in the documents. Please try rephrasing your question or ask something else! 😊`;
                }
            } else {
                // Step 3: Generate response with document context
                if (this.geminiService) {
                    // Use Gemini for enhanced response with document context
                    responseMessage = await this.geminiService.generateResponse(userMessage, results);
                    
                    // Add greeting for WhatsApp context
                    if (senderName && (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi'))) {
                        responseMessage = `Hi ${senderName}! ${responseMessage}`;
                    }
                } else if (this.groqService) {
                    // Use Groq with document context optimized for WhatsApp
                    responseMessage = await this.groqService.generateWhatsAppResponseWithContext(userMessage, results, senderName);
                } else {
                    // Fallback to basic concatenation with greeting
                    const greeting = senderName ? `Hi ${senderName}! ` : 'Hi! ';
                    responseMessage = greeting + "Based on the documents, here's what I found:\n\n" + results.slice(0, 2).join('\n\n');
                }
            }

            // Ensure response is suitable for WhatsApp (not too long)
            if (responseMessage.length > 1000) {
                responseMessage = responseMessage.substring(0, 950) + "... 📄\n\nWould you like me to provide more details on any specific part?";
            }

            return responseMessage;

        } catch (error) {
            console.error('Error generating enhanced WhatsApp response:', error);
            
            // Fallback to basic response
            if (this.groqService) {
                try {
                    return await this.groqService.generateWhatsAppResponse(userMessage, senderName);
                } catch (groqError) {
                    console.error('Groq fallback also failed:', groqError);
                }
            }
            
            const greeting = senderName ? `Hi ${senderName}! ` : 'Hi! ';
            return greeting + "Sorry, I'm having trouble processing your message right now. Please try again! 🤖";
        }
    }

    /**
     * Get webhook status information
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            configured: !!(this.accessToken && this.verifyToken && this.phoneNumberId),
            groqEnabled: !!this.groqService,
            geminiEnabled: !!this.geminiService,
            apiVersion: this.apiVersion
        };
    }
}

export default WhatsAppService;