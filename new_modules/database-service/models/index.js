import BaseModel from './BaseModel.js';
import User from './User.js';

// Initialize all models
const models = {
    User: new User(),
    Conversation: new BaseModel('conversations'),
    Message: new BaseModel('messages'),
    Document: new BaseModel('documents'),
    DocumentChunk: new BaseModel('document_chunks'),
    WhatsAppMessage: new BaseModel('whatsapp_messages'),
    AIRequest: new BaseModel('ai_requests'),
    WebSession: new BaseModel('web_sessions'),
    SystemLog: new BaseModel('system_logs')
};

export default models;