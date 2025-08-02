# API Gateway Service

The API Gateway serves as the main entry point and orchestrator for the chat-bot microservices architecture. It routes requests to appropriate services and provides a configuration interface.

## Features

- **Request Routing**: Routes requests to appropriate microservices
- **Health Monitoring**: Monitors the health of all connected services
- **Configuration UI**: Web-based interface for managing service URLs and settings
- **File Upload Handling**: Processes PDF uploads and routes to document service
- **WhatsApp Integration**: Handles WhatsApp webhook verification and message routing
- **CORS Support**: Enables cross-origin requests for web clients

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your actual service URLs:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Service URLs (Replace with your Render.com URLs)
DOCUMENT_SERVICE_URL=https://your-document-service.onrender.com
AI_SERVICE_URL=https://your-ai-service.onrender.com
WHATSAPP_SERVICE_URL=https://your-whatsapp-service.onrender.com
WEB_SERVICE_URL=https://your-web-service.onrender.com
DATABASE_SERVICE_URL=https://your-database-service.onrender.com

# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database

# Security
SERVICE_API_KEY=your-secure-api-key-here
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Service

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

## Configuration Interface

Access the configuration interface at: `http://localhost:3000`

The interface provides:

- **System Status**: Real-time health monitoring of all services
- **Service Configuration**: Update service URLs dynamically
- **Environment Settings**: Manage environment variables
- **Quick Actions**: Test chat, WhatsApp, and other functionalities

## API Endpoints

### Health Check
```http
GET /health
```
Returns the health status of all connected services.

### Chat
```http
POST /chat
Content-Type: application/json

{
  "message": "Your question here"
}
```

### File Upload
```http
POST /upload
Content-Type: multipart/form-data

pdf: [file]
```

### WhatsApp Webhook
```http
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
POST /webhook/whatsapp
```

### Configuration API
```http
GET /api/config
POST /api/config/services
```

## Deployment on Render.com

### 1. Create New Web Service

1. Go to [Render.com](https://render.com) dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `new_modules/api-gateway` folder as the root directory

### 2. Configure Build Settings

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18 or higher

### 3. Environment Variables

Add these environment variables in Render dashboard:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DOCUMENT_SERVICE_URL` | `https://your-document-service.onrender.com` |
| `AI_SERVICE_URL` | `https://your-ai-service.onrender.com` |
| `WHATSAPP_SERVICE_URL` | `https://your-whatsapp-service.onrender.com` |
| `WEB_SERVICE_URL` | `https://your-web-service.onrender.com` |
| `DATABASE_SERVICE_URL` | `https://your-database-service.onrender.com` |
| `DATABASE_URL` | Your PostgreSQL connection string |
| `SERVICE_API_KEY` | Generate a secure random key |

### 4. Custom Domain (Optional)

Configure a custom domain in Render settings if needed.

## Service Communication

The API Gateway communicates with other services using HTTP requests:

```javascript
// Example: Route to AI service
const response = await axios.post(`${AI_SERVICE_URL}/generate`, {
  message: userMessage,
  context: searchResults,
  type: 'chat'
});
```

## Error Handling

The gateway implements comprehensive error handling:

- Service unavailability fallbacks
- Request timeout handling
- Graceful degradation when services are down
- Detailed error logging

## Security Features

- **API Key Authentication**: Secure inter-service communication
- **CORS Configuration**: Controlled cross-origin access
- **Rate Limiting**: Prevents abuse (configurable)
- **Input Validation**: Validates all incoming requests

## Monitoring

The service provides:

- Health check endpoints for all connected services
- Real-time status monitoring via web interface
- Uptime tracking
- Service response time monitoring

## Troubleshooting

### Common Issues

1. **Service Unavailable Errors**
   - Check if target services are running
   - Verify service URLs in environment variables
   - Check network connectivity

2. **Configuration Not Loading**
   - Ensure all environment variables are set
   - Check file permissions
   - Verify service URLs are accessible

3. **Upload Failures**
   - Check file size limits
   - Verify document service is running
   - Check disk space

### Logs

Check application logs for detailed error information:

```bash
# Local development
npm start

# Production (Render.com)
Check logs in Render dashboard
```

## Development

### Local Development Setup

1. Clone the repository
2. Navigate to the api-gateway directory
3. Copy `.env.example` to `.env`
4. Update service URLs to point to local services
5. Install dependencies: `npm install`
6. Start the service: `npm run dev`

### Testing

Test the service using the configuration interface or API endpoints:

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test chat endpoint
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, world!"}'
```

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Update documentation for new features
4. Test all endpoints before deployment

## License

ISC License