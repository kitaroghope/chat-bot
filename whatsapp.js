import axios from 'axios';
import crypto from 'crypto';
import GroqService from './groq.js';

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
            console.error('Error sending message:', error.response?.data || error.message);
            throw error;
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
            throw new Error('WhatsApp credentials not configured');
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
            console.error('Error marking message as read:', error.response?.data || error.message);
            throw error;
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

                // Mark message as read
                await this.markAsRead(messageId);

                // Get sender info
                const contact = value.contacts?.find(c => c.wa_id === from);
                const senderName = contact?.profile?.name || '';

                let responseMessage = '';

                if (messageType === 'text') {
                    const userMessage = message.text.body;
                    console.log(`Received message from ${from} (${senderName}): ${userMessage}`);

                    // Generate AI response using Groq
                    if (this.groqService) {
                        try {
                            responseMessage = await this.groqService.generateWhatsAppResponse(userMessage, senderName);
                        } catch (error) {
                            console.error('Error generating AI response:', error);
                            responseMessage = "Sorry, I'm having trouble processing your message right now. Please try again! 🤖";
                        }
                    } else {
                        responseMessage = `Hi ${senderName}! I received your message: "${userMessage}". I'm currently running in basic mode. Please configure Groq API for AI responses.`;
                    }

                    // Send response
                    await this.sendMessage(from, responseMessage);
                } else {
                    // Handle other message types
                    responseMessage = `Hi ${senderName}! I received your ${messageType} message. Currently, I can only respond to text messages. 📱`;
                    await this.sendMessage(from, responseMessage);
                }
            }
        } catch (error) {
            console.error('Error processing webhook message:', error);
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
            apiVersion: this.apiVersion
        };
    }
}

export default WhatsAppService;