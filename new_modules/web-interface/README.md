# Web Interface Service

The Web Interface Service provides a modern, real-time chat interface for users to interact with the AI chat-bot. It features Socket.IO for real-time communication, file upload capabilities, and a configuration interface for managing service connections.

## Features

- **Real-time Chat**: Socket.IO powered chat with typing indicators and live responses
- **File Upload**: Drag-and-drop PDF upload with progress tracking
- **Session Management**: Automatic session handling and cleanup
- **Service Integration**: Connects to all microservices via API Gateway
- **Configuration UI**: Web-based interface for managing service URLs and settings
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Error Handling**: Graceful error handling with user-friendly messages

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your actual service URLs:

```env
# Server Configuration
PORT=3004
NODE_ENV=production

# Service URLs (Update with your Render.com URLs)
API_GATEWAY_URL=https://your-api-gateway.onrender.com
DOCUMENT_SERVICE_URL=https://your-document-service.onrender.com
AI_SERVICE_URL=https://your-ai-service.onrender.com
WHATSAPP_SERVICE_URL=https://your-whatsapp-service.onrender.com

# Session Configuration
SESSION_TIMEOUT=3600000
MAX_MESSAGE_LENGTH=1000

# Feature Flags
UPLOAD_ENABLED=true
WHATSAPP_ENABLED=true

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

## User Interface

### Main Chat Interface (`/`)

The main chat interface provides:

- **Real-time Messaging**: Instant chat with AI responses
- **File Upload**: PDF document upload with drag-and-drop support
- **Typing Indicators**: Shows when the AI is processing responses
- **Message History**: Persistent chat history during session
- **Mobile Responsive**: Works seamlessly on mobile devices

### Configuration Interface (`/config`)

The configuration interface allows:

- **Service Status Monitoring**: Real-time health checks of all services
- **Service URL Management**: Update service URLs dynamically
- **Interface Settings**: Configure session timeout, message limits, and features
- **Quick Actions**: Test chat, upload, and other functionalities

## API Endpoints

### Health Check
```http
GET /health
```
Returns service health status and active session count.

### Web Chat
```http
POST /web-chat
Content-Type: application/json

{
  "message": "User's question",
  "session_id": "optional_session_id"
}
```

### File Upload
```http
POST /upload
Content-Type: application/json

{
  "file_data": "base64_encoded_pdf_content",
  "filename": "document.pdf"
}
```

### Configuration Management
```http
GET /api/config
POST /api/config/services
```

### Service Status
```http
GET /api/services/status
```

### Chat History
```http
GET /api/chat-history/:sessionId
```

## Socket.IO Events

### Client to Server Events

#### Join Session
```javascript
socket.emit('join-session', sessionId);
```

#### Send Chat Message
```javascript
socket.emit('chat-message', {
  message: 'User message',
  session_id: 'session_id'
});
```

#### File Upload
```javascript
socket.emit('file-upload', {
  file_data: 'base64_data',
  filename: 'document.pdf',
  session_id: 'session_id'
});
```

### Server to Client Events

#### Chat Response
```javascript
socket.on('chat-response', (data) => {
  // data: { response, session_id, timestamp, sources, processing_time }
});
```

#### Typing Indicator
```javascript
socket.on('typing', (data) => {
  // data: { user: 'bot', typing: true/false }
});
```

#### Upload Progress
```javascript
socket.on('upload-progress', (data) => {
  // data: { stage, percent }
});
```

#### Upload Complete
```javascript
socket.on('upload-complete', (data) => {
  // data: { success, chunks_created, processing_time }
});
```

#### Error Handling
```javascript
socket.on('error', (data) => {
  // data: { message, details }
});
```

## Deployment on Render.com

### 1. Create New Web Service

1. Go to [Render.com](https://render.com) dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `new_modules/web-interface` folder as the root directory

### 2. Configure Build Settings

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18 or higher

### 3. Environment Variables

Add these environment variables in Render dashboard:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `API_GATEWAY_URL` | Your API Gateway URL | Yes |
| `DOCUMENT_SERVICE_URL` | Your Document Service URL | Yes |
| `AI_SERVICE_URL` | Your AI Service URL | Yes |
| `WHATSAPP_SERVICE_URL` | Your WhatsApp Service URL | Yes |
| `SERVICE_API_KEY` | Generate a secure random key | Yes |
| `SESSION_TIMEOUT` | `3600000` (1 hour) | No |
| `MAX_MESSAGE_LENGTH` | `1000` | No |
| `UPLOAD_ENABLED` | `true` | No |
| `WHATSAPP_ENABLED` | `true` | No |

## Session Management

### Session Creation
- Sessions are automatically created when users start chatting
- Each session gets a unique ID for tracking
- Sessions are stored in memory (could be extended to use Redis)

### Session Cleanup
- Sessions expire after the configured timeout (default: 1 hour)
- Cleanup runs every 5 minutes to remove expired sessions
- Socket connections are automatically cleaned up on disconnect

### Session Features
- **Persistent Chat**: Messages persist during the session
- **File Association**: Uploaded files are associated with sessions
- **Multi-tab Support**: Same session can be used across multiple tabs

## Real-time Features

### Socket.IO Integration
- **Connection Management**: Automatic reconnection on network issues
- **Room Management**: Users join session-specific rooms
- **Event Broadcasting**: Messages broadcast to all tabs in same session

### Typing Indicators
- Shows when AI is processing responses
- Animated dots indicate active processing
- Automatically hidden when response arrives

### Live Updates
- Real-time chat responses
- Upload progress tracking
- Service status updates
- Error notifications

## Security Features

- **CORS Configuration**: Controlled cross-origin access
- **Input Validation**: Validates all user inputs
- **File Type Validation**: Only allows PDF uploads
- **Size Limits**: Enforces file size limits
- **Session Isolation**: Sessions are isolated from each other
- **API Key Authentication**: Secure inter-service communication

## Performance Considerations

### Memory Usage
- Base service: ~30MB
- Per session: ~1-5MB
- Socket connections: ~1MB each
- Total: ~50-100MB for typical usage

### Scalability
- Sessions stored in memory (consider Redis for scaling)
- Socket.IO supports clustering with Redis adapter
- File uploads processed asynchronously
- Service calls are non-blocking

### Optimization
- Static file caching
- Gzip compression
- Connection pooling for service calls
- Automatic session cleanup

## Error Handling

The service handles various error conditions:

- **Service Unavailability**: Graceful degradation when services are down
- **Network Errors**: Automatic retry mechanisms
- **File Upload Errors**: Clear error messages and recovery
- **Socket Disconnections**: Automatic reconnection attempts
- **Session Expiry**: Graceful session cleanup and user notification

## Monitoring

The service provides:

- **Health Check Endpoint**: Monitor service availability
- **Active Session Count**: Track concurrent users
- **Service Status Monitoring**: Real-time status of all connected services
- **Uptime Tracking**: Service uptime statistics
- **Error Logging**: Detailed error tracking and reporting

## Troubleshooting

### Common Issues

1. **Socket.IO Connection Issues**
   - Check CORS configuration
   - Verify allowed origins
   - Check firewall settings

2. **Service Connection Errors**
   - Verify service URLs are correct
   - Check service health endpoints
   - Ensure API keys are configured

3. **File Upload Failures**
   - Check file size limits
   - Verify file type restrictions
   - Ensure document service is running

4. **Session Issues**
   - Check session timeout settings
   - Verify session cleanup is running
   - Monitor memory usage

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
2. Navigate to the web-interface directory
3. Copy `.env.example` to `.env`
4. Update service URLs in `.env`
5. Install dependencies: `npm install`
6. Start the service: `npm run dev`

### Testing

Test the service using the web interface:

1. Access `http://localhost:3004`
2. Test chat functionality
3. Test file upload
4. Check configuration interface at `/config`

### Adding New Features

1. Follow the existing code structure
2. Add proper error handling
3. Update Socket.IO events if needed
4. Test real-time functionality
5. Update documentation

## Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Update documentation for new features
4. Test all functionality before deployment
5. Consider mobile responsiveness

## License

ISC License