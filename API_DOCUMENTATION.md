# Chat-Bot Microservices API Documentation

## Architecture Overview

The chat-bot application is broken down into 6 independent microservices:

1. **API Gateway Service** - Main orchestrator and request router
2. **Document Processing Service** - PDF processing, text extraction, and vector search
3. **AI Services** - Groq and Gemini AI text generation
4. **WhatsApp Service** - WhatsApp webhook processing and messaging
5. **Web Interface Service** - Static frontend and web chat
6. **Database Service** - PostgreSQL with vector storage

## Service URLs (Example Render.com Deployment)

```
API Gateway:           https://chatbot-gateway.onrender.com
Document Service:      https://chatbot-docs.onrender.com
AI Service:           https://chatbot-ai.onrender.com
WhatsApp Service:     https://chatbot-whatsapp.onrender.com
Web Interface:        https://chatbot-web.onrender.com
Database:             Internal PostgreSQL connection
```

---

## 1. API Gateway Service

**Base URL**: `https://chatbot-gateway.onrender.com`

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "document": "healthy",
    "ai": "healthy",
    "whatsapp": "healthy",
    "web": "healthy"
  },
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Chat Endpoint (Web Interface)
```http
POST /chat
Content-Type: application/json

{
  "message": "What is machine learning?"
}
```

**Response:**
```json
{
  "response": "Machine learning is a subset of artificial intelligence...",
  "sources": ["document_chunk_1", "document_chunk_2"],
  "processing_time": 1.2
}
```

### File Upload
```http
POST /upload
Content-Type: multipart/form-data

pdf: [file]
```

**Response:**
```json
{
  "success": true,
  "message": "Document processed successfully",
  "chunks_processed": 45,
  "processing_time": 15.3
}
```

### WhatsApp Webhook (Verification)
```http
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

### WhatsApp Webhook (Message Processing)
```http
POST /webhook/whatsapp
Content-Type: application/json
X-Hub-Signature-256: sha256=signature

{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "1234567890",
                "id": "msg_id",
                "type": "text",
                "text": {
                  "body": "Hello, what is AI?"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## 2. Document Processing Service

**Base URL**: `https://chatbot-docs.onrender.com`

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "embedding_model": "Xenova/all-MiniLM-L6-v2",
  "database_connection": "active",
  "documents_count": 1250
}
```

### Process Document
```http
POST /process-document
Content-Type: application/json

{
  "file_data": "base64_encoded_pdf_content",
  "filename": "document.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "document_id": "doc_123",
  "chunks_created": 45,
  "processing_time": 12.5,
  "text_length": 15000
}
```

### Vector Search
```http
POST /search
Content-Type: application/json

{
  "query": "machine learning algorithms",
  "top_k": 3,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "results": [
    {
      "text": "Machine learning algorithms are computational methods...",
      "score": 0.89,
      "document_id": "doc_123",
      "chunk_id": "chunk_45"
    },
    {
      "text": "Supervised learning is a type of machine learning...",
      "score": 0.85,
      "document_id": "doc_124",
      "chunk_id": "chunk_12"
    }
  ],
  "query_time": 0.3
}
```

### Get Document Stats
```http
GET /stats
```

**Response:**
```json
{
  "total_documents": 15,
  "total_chunks": 1250,
  "database_size": "45MB",
  "last_updated": "2025-01-01T12:00:00Z"
}
```

---

## 3. AI Services (Groq/Gemini)

**Base URL**: `https://chatbot-ai.onrender.com`

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "groq": "active",
    "gemini": "active"
  },
  "models": {
    "groq": "llama3-8b-8192",
    "gemini": "gemini-1.5-flash"
  }
}
```

### Generate Response
```http
POST /generate
Content-Type: application/json

{
  "message": "What is machine learning?",
  "context": [
    "Machine learning is a subset of artificial intelligence...",
    "It involves training algorithms on data..."
  ],
  "type": "chat",
  "service": "gemini"
}
```

**Response:**
```json
{
  "response": "Based on the provided context, machine learning is a subset of artificial intelligence that involves training algorithms on data to make predictions or decisions without being explicitly programmed for each specific task.",
  "service_used": "gemini",
  "processing_time": 1.1,
  "tokens_used": 150
}
```

### Optimize Query
```http
POST /optimize-query
Content-Type: application/json

{
  "query": "How do I train a model for image recognition?",
  "service": "gemini"
}
```

**Response:**
```json
{
  "original_query": "How do I train a model for image recognition?",
  "optimized_query": "image recognition model training deep learning CNN convolutional neural networks",
  "service_used": "gemini",
  "processing_time": 0.5
}
```

### Generate WhatsApp Response
```http
POST /generate-whatsapp
Content-Type: application/json

{
  "message": "Hi, what is AI?",
  "context": ["AI context from documents..."],
  "sender_name": "John",
  "service": "groq"
}
```

**Response:**
```json
{
  "response": "Hi John! 👋 AI (Artificial Intelligence) is technology that enables machines to simulate human intelligence. Based on the documents, it includes machine learning, natural language processing, and computer vision. Would you like to know more about any specific area? 🤖",
  "service_used": "groq",
  "processing_time": 0.8,
  "character_count": 245
}
```

---

## 4. WhatsApp Service

**Base URL**: `https://chatbot-whatsapp.onrender.com`

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "whatsapp_api": "connected",
  "webhook_verified": true,
  "phone_number_id": "123456789",
  "api_version": "v18.0"
}
```

### Process Webhook
```http
POST /webhook
Content-Type: application/json
X-Hub-Signature-256: sha256=signature

{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "1234567890",
                "id": "msg_id",
                "type": "text",
                "text": {
                  "body": "Hello, what is AI?"
                }
              }
            ],
            "contacts": [
              {
                "wa_id": "1234567890",
                "profile": {
                  "name": "John Doe"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "messages_processed": 1,
  "responses_sent": 1
}
```

### Send Message
```http
POST /send-message
Content-Type: application/json

{
  "to": "1234567890",
  "message": "Hello! How can I help you today?"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "wamid.123456789",
  "status": "sent",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Get Status
```http
GET /status
```

**Response:**
```json
{
  "configured": true,
  "access_token_valid": true,
  "webhook_verified": true,
  "messages_sent_today": 45,
  "messages_received_today": 38,
  "last_activity": "2025-01-01T11:55:00Z"
}
```

### Verify Webhook
```http
GET /verify-webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

**Response:**
```
CHALLENGE (plain text)
```

---

## 5. Web Interface Service

**Base URL**: `https://chatbot-web.onrender.com`

### Serve Web Interface
```http
GET /
```

**Response:** HTML page with chat interface

### Web Chat
```http
POST /web-chat
Content-Type: application/json

{
  "message": "What is machine learning?",
  "session_id": "session_123"
}
```

**Response:**
```json
{
  "response": "Machine learning is a subset of artificial intelligence...",
  "session_id": "session_123",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "active_sessions": 5,
  "uptime": "2d 5h 30m"
}
```

---

## Inter-Service Communication

### API Gateway → Document Service
```javascript
// Process document
const response = await fetch(`${DOCUMENT_SERVICE_URL}/process-document`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    file_data: base64Data,
    filename: filename
  })
});

// Search documents
const searchResponse = await fetch(`${DOCUMENT_SERVICE_URL}/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: optimizedQuery,
    top_k: 3
  })
});
```

### API Gateway → AI Service
```javascript
// Generate response
const aiResponse = await fetch(`${AI_SERVICE_URL}/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userMessage,
    context: searchResults,
    type: 'chat',
    service: 'gemini'
  })
});

// Optimize query
const queryResponse = await fetch(`${AI_SERVICE_URL}/optimize-query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: userQuery,
    service: 'gemini'
  })
});
```

### API Gateway → WhatsApp Service
```javascript
// Process webhook
const webhookResponse = await fetch(`${WHATSAPP_SERVICE_URL}/webhook`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature
  },
  body: JSON.stringify(webhookData)
});

// Send message
const sendResponse = await fetch(`${WHATSAPP_SERVICE_URL}/send-message`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: phoneNumber,
    message: responseText
  })
});
```

## Error Handling

All services return consistent error responses:

```json
{
  "error": true,
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-01T12:00:00Z",
  "service": "service_name"
}
```

### Common Error Codes

- `INVALID_REQUEST` - Malformed request data
- `SERVICE_UNAVAILABLE` - Downstream service is down
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `AUTHENTICATION_FAILED` - Invalid API key or token
- `PROCESSING_ERROR` - Error during document/AI processing
- `DATABASE_ERROR` - Database connection or query error

## Rate Limiting

Each service implements rate limiting:

- **API Gateway**: 100 requests/minute per IP
- **Document Service**: 10 uploads/hour per IP
- **AI Service**: 60 requests/minute per IP
- **WhatsApp Service**: 1000 messages/day per phone number
- **Web Interface**: 200 requests/minute per session

## Authentication

Services use API keys for inter-service communication:

```http
Authorization: Bearer SERVICE_API_KEY
```

Environment variables for each service:
- `API_GATEWAY_KEY`
- `DOCUMENT_SERVICE_KEY`
- `AI_SERVICE_KEY`
- `WHATSAPP_SERVICE_KEY`
- `WEB_SERVICE_KEY`

## Database Schema

### PostgreSQL Tables

```sql
-- Documents table
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    text_length INTEGER,
    chunk_count INTEGER
);

-- Vector chunks table
CREATE TABLE vector_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    chunk_text TEXT NOT NULL,
    embedding VECTOR(384), -- Using pgvector extension
    chunk_index INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat sessions (for web interface)
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp message log
CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    message_id VARCHAR(255) UNIQUE,
    direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
    message_text TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'sent'
);
```

## Deployment Configuration

### Render.com Service Settings

Each service requires these environment variables:

**Common Variables:**
```
NODE_ENV=production
DATABASE_URL=postgresql://...
API_GATEWAY_URL=https://chatbot-gateway.onrender.com
DOCUMENT_SERVICE_URL=https://chatbot-docs.onrender.com
AI_SERVICE_URL=https://chatbot-ai.onrender.com
WHATSAPP_SERVICE_URL=https://chatbot-whatsapp.onrender.com
WEB_SERVICE_URL=https://chatbot-web.onrender.com
```

**Service-Specific Variables:**
- **AI Service**: `GROQ_API_KEY`, `GEMINI_API_KEY`
- **WhatsApp Service**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`
- **All Services**: `SERVICE_API_KEY` (unique per service)

### Resource Allocation

| Service | RAM | CPU | Storage | Build Time |
|---------|-----|-----|---------|------------|
| API Gateway | 256MB | 0.1 CPU | 1GB | 5 min |
| Document Service | 512MB | 0.5 CPU | 2GB | 15 min |
| AI Service | 256MB | 0.1 CPU | 1GB | 5 min |
| WhatsApp Service | 256MB | 0.1 CPU | 1GB | 5 min |
| Web Interface | 128MB | 0.1 CPU | 512MB | 3 min |

**Total Free Tier Usage:**
- RAM: 1.4GB (within 512MB per service limit)
- Build Time: 33 minutes (within 90 min/month limit)
- Services: 5 web services (within free tier limit)