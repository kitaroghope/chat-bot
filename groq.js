import Groq from 'groq-sdk';

class GroqService {
    constructor() {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is required in environment variables');
        }
        
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
        
        this.model = 'llama3-8b-8192'; // Default model
    }

    /**
     * Generate a response using Groq AI
     * @param {string} message - User message
     * @param {Array} context - Optional context from vector search
     * @returns {Promise<string>} - AI response
     */
    async generateResponse(message, context = []) {
        try {
            let systemPrompt = `You are a helpful WhatsApp assistant. Respond in a conversational, friendly manner. Keep responses concise and relevant for mobile messaging.`;
            
            if (context && context.length > 0) {
                systemPrompt += `\n\nContext from documents:\n${context.join('\n\n')}`;
            }

            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                model: this.model,
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 1,
                stream: false,
                stop: null
            });

            return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
        } catch (error) {
            console.error('Groq API error:', error);
            throw new Error('Failed to generate response with Groq AI');
        }
    }

    /**
     * Optimize search query using Groq AI
     * @param {string} query - Original query
     * @returns {Promise<string>} - Optimized query
     */
    async optimizeQuery(query) {
        try {
            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a query optimization assistant. Transform the user's question into a better search query by extracting key terms and concepts. Return only the optimized query, nothing else."
                    },
                    {
                        role: "user",
                        content: query
                    }
                ],
                model: this.model,
                temperature: 0.3,
                max_tokens: 100,
                top_p: 1,
                stream: false,
                stop: null
            });

            return completion.choices[0]?.message?.content || query;
        } catch (error) {
            console.error('Query optimization error:', error);
            return query; // Return original query if optimization fails
        }
    }

    /**
     * Generate a WhatsApp-specific response
     * @param {string} message - User message
     * @param {string} senderName - Sender's name (optional)
     * @returns {Promise<string>} - WhatsApp formatted response
     */
    async generateWhatsAppResponse(message, senderName = '') {
        try {
            const greeting = senderName ? `Hi ${senderName}! ` : 'Hi! ';
            
            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful WhatsApp bot assistant. Respond naturally and conversationally. Keep responses under 300 characters when possible. Use emojis appropriately. Be friendly and helpful.`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                model: this.model,
                temperature: 0.8,
                max_tokens: 200,
                top_p: 1,
                stream: false,
                stop: null
            });

            let response = completion.choices[0]?.message?.content || "I'm here to help! 😊";
            
            // Add greeting for first-time interactions
            if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
                response = greeting + response;
            }

            return response;
        } catch (error) {
            console.error('WhatsApp response generation error:', error);
            return "Sorry, I'm having trouble responding right now. Please try again! 🤖";
        }
    }

    /**
     * Generate a WhatsApp response with document context
     * @param {string} message - User message
     * @param {Array} context - Context from vector search
     * @param {string} senderName - Sender's name (optional)
     * @returns {Promise<string>} - WhatsApp formatted response with context
     */
    async generateWhatsAppResponseWithContext(message, context = [], senderName = '') {
        try {
            let systemPrompt = `You are a helpful WhatsApp bot assistant. Respond naturally and conversationally based on the provided document context. Keep responses under 500 characters when possible. Use emojis appropriately. Be friendly and helpful.`;
            
            if (context && context.length > 0) {
                systemPrompt += `\n\nContext from documents:\n${context.join('\n\n')}`;
            }

            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                model: this.model,
                temperature: 0.7,
                max_tokens: 300,
                top_p: 1,
                stream: false,
                stop: null
            });

            let response = completion.choices[0]?.message?.content || "I'm here to help! 😊";
            
            // Add greeting for first-time interactions
            if (senderName && (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi'))) {
                const greeting = `Hi ${senderName}! `;
                if (!response.toLowerCase().startsWith('hi')) {
                    response = greeting + response;
                }
            }

            return response;
        } catch (error) {
            console.error('WhatsApp context response generation error:', error);
            return "Sorry, I'm having trouble responding right now. Please try again! 🤖";
        }
    }

    /**
     * Set the model to use for Groq API calls
     * @param {string} model - Model name
     */
    setModel(model) {
        this.model = model;
    }

    /**
     * Get available models (static list for now)
     * @returns {Array<string>} - Available model names
     */
    getAvailableModels() {
        return [
            'llama3-8b-8192',
            'llama3-70b-8192',
            'mixtral-8x7b-32768',
            'gemma-7b-it'
        ];
    }
}

export default GroqService;