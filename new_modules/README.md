# Chat Bot Microservices Architecture

A modular chat bot system built with Node.js microservices and Neon PostgreSQL database, featuring AI integration (Groq/Gemini), document processing with vector search, WhatsApp Business API, and real-time web interface.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  Web Interface  │    │ WhatsApp Service│
│    Port 3000    │    │    Port 3004    │    │    Port 3003    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
        ┌─────────────────┬──────┴──────┬─────────────────┐
        │                 │             │                 │
┌───────▼──────┐ ┌────────▼──────┐ ┌────▼────────┐ ┌─────▼──────┐
│ AI Service   │ │Document Service│ │   Database  │ │  Web UI    │
│  Port 3002   │ │   Port 3001    │ │  Service    │ │ (Socket.IO)│
│              │ │                │ │  Port 3005  │ │            │
│ • Groq       │ │ • PDF Parser   │ │             │ │ • Chat     │
│ • Gemini     │ │ • Vector Search│ │ • Neon PG   │ │ • Config   │
└──────────────┘ └────────────────┘ │ • REST API  │ └────────────┘
                                    │ • Migrations│
                                    └─────────────┘
```

## Services

### 1. Database Service (Port 3005)
**Central database service using Neon PostgreSQL**
- Full CRUD API for all entities
- User authentication and management
- Document storage and vector embeddings
- AI request logging and analytics
- WhatsApp message tracking
- Real-time session management

### 2. API Gateway (Port 3000)
**Central routing and service orchestration**
- Routes requests to appropriate services
- Health monitoring for all services
- Request/response logging
- Service discovery

### 3. Document Service (Port 3001)
**PDF processing and vector search**
- PDF text extraction
- Text chunking and embedding generation
- Vector similarity search
- Document management and storage

### 4. AI Service (Port 3002)
**AI text generation with multiple providers**
- Groq API integration (Llama models)
- Google Gemini integration
- Request logging and analytics
- Fallback service handling

### 5. WhatsApp Service (Port 3003)
**WhatsApp Business API integration**
- Webhook processing
- Message sending and receiving
- User profile management
- Message history tracking

### 6. Web Interface (Port 3004)
**Real-time chat interface**
- Socket.IO for real-time communication
- File upload and document processing
- Configuration management
- Chat history and sessions

## Database Schema

### Core Tables
- **users**: User authentication and profiles
- **conversations**: Chat sessions and contexts
- **messages**: All chat messages with threading
- **documents**: File uploads and processing status
- **document_chunks**: Vector embeddings for similarity search

### Integration Tables
- **whatsapp_messages**: WhatsApp Business API messages
- **ai_requests**: AI service request tracking and analytics
- **web_sessions**: Socket.IO session management
- **system_logs**: Comprehensive audit trail

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Neon PostgreSQL database account
- API keys for Groq and/or Google Gemini
- WhatsApp Business API credentials (optional)

### 1. Environment Setup

Copy environment files for all services:
```bash
# Copy all .env.example files to .env
cp api-gateway/.env.example api-gateway/.env
cp document-service/.env.example document-service/.env
cp ai-service/.env.example ai-service/.env
cp whatsapp-service/.env.example whatsapp-service/.env
cp web-interface/.env.example web-interface/.env
cp database-service/.env.example database-service/.env
```

### 2. Configure Database Service
Edit `database-service/.env`:
```env
DATABASE_URL=postgresql://username:password@your-neon-endpoint/database?sslmode=require
PORT=3005
NODE_ENV=development
JWT_SECRET=your-strong-jwt-secret-here
BCRYPT_ROUNDS=12
```

### 3. Configure AI Service
Edit `ai-service/.env`:
```env
PORT=3002
DATABASE_SERVICE_URL=http://localhost:3005
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_API_KEY=your_google_gemini_api_key_here
```

### 4. Configure WhatsApp Service (Optional)
Edit `whatsapp-service/.env`:
```env
PORT=3003
DATABASE_SERVICE_URL=http://localhost:3005
WHATSAPP_TOKEN=your_whatsapp_business_token
VERIFY_TOKEN=your_webhook_verify_token
```

### 5. Install Dependencies
```bash
# Install dependencies for all services
cd database-service && npm install && cd ..
cd api-gateway && npm install && cd ..
cd document-service && npm install && cd ..
cd ai-service && npm install && cd ..
cd whatsapp-service && npm install && cd ..
cd web-interface && npm install && cd ..
```

### 6. Initialize Database
```bash
cd database-service
npm run migrate
```

### 7. Start Services
Start services in this order:

```bash
# Terminal 1 - Database Service (must start first)
cd database-service
npm start

# Terminal 2 - API Gateway
cd api-gateway
npm start

# Terminal 3 - Document Service
cd document-service
npm start

# Terminal 4 - AI Service
cd ai-service
npm start

# Terminal 5 - WhatsApp Service
cd whatsapp-service
npm start

# Terminal 6 - Web Interface
cd web-interface
npm start
```

## Service URLs

- **API Gateway**: http://localhost:3000
- **Document Service**: http://localhost:3001
- **AI Service**: http://localhost:3002
- **WhatsApp Service**: http://localhost:3003
- **Web Interface**: http://localhost:3004
- **Database Service**: http://localhost:3005

## API Documentation

### Database Service API
- `GET /health` - Service health check
- `GET /api/status` - Database status and metrics
- `POST /api/users` - Create user
- `GET/PUT/DELETE /api/{entity}/{id}` - CRUD operations
- Full CRUD for: users, conversation, message, document, documentchunk, whatsappmessage, airequest, websession, systemlog

### Document Service API
- `POST /process-document` - Process PDF with vector embeddings
- `POST /search` - Vector similarity search
- `GET /health` - Service status

### AI Service API
- `POST /generate` - Generate AI response
- `GET /health` - Service status
- `GET /api/config` - Service configuration

### WhatsApp Service API
- `GET /webhook` - Webhook verification
- `POST /webhook` - Webhook processing
- `POST /send-message` - Send WhatsApp message

## Development

### Adding New Entities
1. Add table to `database-service/migrations/001_initial_schema.sql`
2. Update `database-service/models/index.js` to include new model
3. Run migrations: `npm run migrate` in database-service
4. Use generic CRUD endpoints automatically available

### Custom Business Logic
- Add custom controllers in respective services
- Use DatabaseClient for database operations
- Log important actions to system_logs table

### Monitoring
- Check service health: `GET /{service}/health`
- Monitor database metrics: `GET /api/status` on database service
- View system logs: `GET /api/systemlog` on database service

## Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=your_production_neon_connection
# Add all service URLs with production domains
# Add proper JWT secrets and API keys
```

### Recommended Deployment Platforms
- **Database**: Neon PostgreSQL (serverless, auto-scaling)
- **Services**: Render, Railway, or Heroku
- **Alternative**: Docker containers on AWS ECS, Google Cloud Run, or Azure Container Instances

### Security Considerations
- Use environment variables for all secrets
- Enable HTTPS in production
- Implement rate limiting
- Add authentication middleware
- Validate all inputs
- Use connection pooling for database

## Troubleshooting

### Common Issues
1. **Database connection fails**: Check DATABASE_URL format and Neon credentials
2. **Services can't communicate**: Verify service URLs in environment variables
3. **Vector search not working**: Ensure pgvector extension is enabled in Neon
4. **AI services unavailable**: Check API keys and quotas

### Debugging
- Check individual service health endpoints
- Monitor database service status endpoint
- Review system_logs table for detailed error tracking
- Enable debug logging with `NODE_ENV=development`

## Contributing

1. Follow the existing service pattern for new features
2. Add proper error handling and logging
3. Update database schema via migrations
4. Add tests for new functionality
5. Update documentation