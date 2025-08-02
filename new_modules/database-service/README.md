# Database Service

Centralized database service using Neon PostgreSQL for the chat-bot microservices architecture.

## Features

- **Neon PostgreSQL**: Cloud-native PostgreSQL database
- **Comprehensive Schema**: Support for users, conversations, messages, documents, WhatsApp integration, AI requests, and more
- **Vector Search**: Document embeddings with similarity search using pgvector
- **RESTful API**: Full CRUD operations for all entities
- **Migrations**: Database schema versioning and migrations
- **Health Monitoring**: Database connection and performance monitoring

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```
   
   Update with your Neon PostgreSQL connection string:
   ```env
   DATABASE_URL=postgresql://username:password@your-neon-endpoint/database?sslmode=require
   PORT=3005
   NODE_ENV=development
   ```

3. **Run Migrations**:
   ```bash
   npm run migrate
   ```

4. **Start the service**:
   ```bash
   npm start
   ```

## API Endpoints

### Health & Status
- `GET /health` - Service health check
- `GET /api/status` - Database status and metrics

### Users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user
- `GET /api/users/email/:email` - Get user by email
- `GET /api/users/whatsapp/:whatsappId` - Get user by WhatsApp ID

### Generic CRUD (for all entities)
- `GET /api/{entity}` - Get all records (with pagination)
- `GET /api/{entity}/:id` - Get single record
- `POST /api/{entity}` - Create new record
- `PUT /api/{entity}/:id` - Update record
- `DELETE /api/{entity}/:id` - Delete record

Supported entities:
- `conversation` - Chat conversations
- `message` - Chat messages
- `document` - Uploaded documents
- `documentchunk` - Document embeddings
- `whatsappmessage` - WhatsApp messages
- `airequest` - AI service requests
- `websession` - Web interface sessions
- `systemlog` - System audit logs

## Database Schema

### Core Tables
- **users**: User authentication and profiles
- **conversations**: Chat sessions
- **messages**: All chat messages
- **documents**: File uploads and processing
- **document_chunks**: Vector embeddings for similarity search

### Integration Tables
- **whatsapp_messages**: WhatsApp Business API integration
- **ai_requests**: AI service request tracking
- **web_sessions**: Socket.IO session management
- **system_logs**: Audit trail and logging

## Usage Examples

### Create a User
```bash
curl -X POST http://localhost:3005/api/users \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "secure123",
    "full_name": "John Doe"
  }'
```

### Create a Conversation
```bash
curl -X POST http://localhost:3005/api/conversation \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "user-uuid-here",
    "title": "My Chat Session",
    "type": "chat"
  }'
```

### Log an AI Request
```bash
curl -X POST http://localhost:3005/api/airequest \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "user-uuid-here",
    "service_type": "groq",
    "model_name": "llama3-8b-8192",
    "prompt": "Hello, how are you?",
    "response": "I am doing well, thank you!",
    "tokens_used": 42,
    "processing_time_ms": 1500,
    "status": "completed"
  }'
```

## Integration with Other Services

Each microservice should connect to this database service instead of maintaining their own database connections:

```javascript
// In other services
const DATABASE_SERVICE_URL = process.env.DATABASE_SERVICE_URL || 'http://localhost:3005';

// Create a user
const response = await fetch(`${DATABASE_SERVICE_URL}/api/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userData)
});
```

## Monitoring

- Monitor database connection pool via `/api/status`
- Check service health via `/health`
- All operations are logged to `system_logs` table
- Performance metrics available through connection pool stats