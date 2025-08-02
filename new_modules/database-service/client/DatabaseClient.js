class DatabaseClient {
    constructor(baseUrl = 'http://localhost:3005') {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Database request failed: ${error.message}`);
            throw error;
        }
    }

    // Generic CRUD methods
    async create(entity, data) {
        return this.request(`/api/${entity}`, {
            method: 'POST',
            body: data
        });
    }

    async findById(entity, id) {
        return this.request(`/api/${entity}/${id}`);
    }

    async findAll(entity, options = {}) {
        const { limit = 100, offset = 0, ...conditions } = options;
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            ...conditions
        });
        
        return this.request(`/api/${entity}?${queryParams}`);
    }

    async update(entity, id, data) {
        return this.request(`/api/${entity}/${id}`, {
            method: 'PUT',
            body: data
        });
    }

    async delete(entity, id) {
        return this.request(`/api/${entity}/${id}`, {
            method: 'DELETE'
        });
    }

    // User-specific methods
    async createUser(userData) {
        return this.request('/api/users', {
            method: 'POST',
            body: userData
        });
    }

    async getUserById(id) {
        return this.request(`/api/users/${id}`);
    }

    async getUserByEmail(email) {
        return this.request(`/api/users/email/${encodeURIComponent(email)}`);
    }

    async getUserByWhatsApp(whatsappId) {
        return this.request(`/api/users/whatsapp/${encodeURIComponent(whatsappId)}`);
    }

    async updateUser(id, userData) {
        return this.request(`/api/users/${id}`, {
            method: 'PUT',
            body: userData
        });
    }

    // Conversation methods
    async createConversation(data) {
        return this.create('conversation', data);
    }

    async getConversationsByUser(userId, options = {}) {
        return this.findAll('conversation', { user_id: userId, ...options });
    }

    // Message methods
    async createMessage(data) {
        return this.create('message', data);
    }

    async getMessagesByConversation(conversationId, options = {}) {
        return this.findAll('message', { conversation_id: conversationId, ...options });
    }

    // Document methods
    async createDocument(data) {
        return this.create('document', data);
    }

    async createDocumentChunk(data) {
        return this.create('documentchunk', data);
    }

    async getDocumentsByUser(userId, options = {}) {
        return this.findAll('document', { user_id: userId, ...options });
    }

    // WhatsApp methods
    async createWhatsAppMessage(data) {
        return this.create('whatsappmessage', data);
    }

    async getWhatsAppMessagesByPhone(phoneNumber, options = {}) {
        return this.findAll('whatsappmessage', { phone_number: phoneNumber, ...options });
    }

    // AI Request methods
    async createAIRequest(data) {
        return this.create('airequest', data);
    }

    async getAIRequestsByUser(userId, options = {}) {
        return this.findAll('airequest', { user_id: userId, ...options });
    }

    // Web Session methods
    async createWebSession(data) {
        return this.create('websession', data);
    }

    async updateWebSession(id, data) {
        return this.update('websession', id, data);
    }

    // System Log methods
    async createSystemLog(data) {
        return this.create('systemlog', data);
    }

    async getSystemLogs(options = {}) {
        return this.findAll('systemlog', options);
    }

    // Health check
    async checkHealth() {
        return this.request('/health');
    }

    async getStatus() {
        return this.request('/api/status');
    }
}

export default DatabaseClient;