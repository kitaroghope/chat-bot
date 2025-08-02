# AI Service

The AI Service provides text generation capabilities using Groq and Gemini AI models. It handles query optimization, response generation, and WhatsApp-specific formatting for the chat-bot microservices architecture.

## Features

- **Dual AI Integration**: Support for both Groq and Gemini AI services
- **Query Optimization**: Improve search queries for better document retrieval
- **Response Generation**: Generate contextual responses based on document content
- **WhatsApp Formatting**: Specialized responses optimized for mobile messaging
- **Configuration UI**: Web-based interface for testing and managing AI services
- **Performance Monitoring**: Track response times and success rates
- **Fallback Support**: Automatic fallback between AI services

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your actual API keys:

```env
# Server Configuration
PORT=3002
NODE_ENV=production

# Groq Configuration (Required for Groq features)
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=llama3-8b-8192

# Gemini Configuration (Required for Gemini features)
GEMINI_API_KEY=your-gemini-api-key-here

# Default Settings
DEFAULT_AI_SERVICE=gemini
TEMPERATURE=0.7
MAX_TOKENS=1024

# Security
SERVICE_API_KEY=your-secure-api-key-here
```

### 2. API Keys Setup

#### Groq API Key
1. Visit [Groq Console](https://console.groq.com/)
2. Create an account or sign in
3. Generate an API key
4. Add it to your `.env` file as `GROQ_API_KEY`

#### Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Service

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

## Configuration Interface

Access the configuration interface at: `http://localhost:3002`

The interface provides:

- **Service Status**: Real-time monitoring of Groq and Gemini services
- **AI Configuration**: Manage API keys and model settings
- **Generation Settings**: Configure temperature, max tokens, and default service
- **AI Testing**: Test different AI functions with custom inputs
- **Performance Monitoring**: Track response times and success rates

## API Endpoints

### Health Check
```http
GET /health
```
Returns the status of both AI services and their configuration.

### Generate Response
```http
POST /generate
Content-Type: application/json

{
  "message": "User's question",
  "context": ["document context 1", "document context 2"],
  "type": "chat",
  "service": "gemini",
  "temperature": 0.7,
  "max_tokens": 1024
}
```

### Optimize Query
```http
POST /optimize-query
Content-Type: application/json

{
  "query": "user search query",
  "service": "gemini"
}
```

### Generate WhatsApp Response
```http
POST /generate-whatsapp
Content-Type: application/json

{
  "message": "User's WhatsApp message",
  "context": ["document context"],
  "sender_name": "John",
  "service": "groq"
}
```

### Test Endpoint
```http
POST /test
Content-Type: application/json

{
  "service": "gemini",
  "message": "Test message"
}
```

### Configuration
```http
GET /api/config
```

## Deployment on Render.com

### 1. Create New Web Service

1. Go to [Render.com](https://render.com) dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `new_modules/ai-service` folder as the root directory

### 2. Configure Build Settings

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18 or higher

### 3. Environment Variables

Add these environment variables in Render dashboard:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `GROQ_API_KEY` | Your Groq API key | Optional* |
| `GEMINI_API_KEY` | Your Gemini API key | Optional* |
| `DEFAULT_AI_SERVICE` | `gemini` or `groq` | Yes |
| `SERVICE_API_KEY` | Generate a secure random key | Yes |
| `TEMPERATURE` | `0.7` | No |
| `MAX_TOKENS` | `1024` | No |

*At least one AI service API key is required.

## AI Service Details

### Groq Integration

**Models Available:**
- `llama3-8b-8192` - Fast, efficient for most tasks
- `llama3-70b-8192` - More capable, slower
- `mixtral-8x7b-32768` - Good balance of speed and capability
- `gemma-7b-it` - Instruction-tuned model

**Best For:**
- WhatsApp responses (fast, conversational)
- Quick query optimization
- High-volume requests

### Gemini Integration

**Models Available:**
- `gemini-1.5-flash` - Fast, cost-effective
- `gemini-1.5-pro` - Most capable, higher cost

**Best For:**
- Document-based responses
- Complex reasoning tasks
- High-quality text generation

## Response Types

### Chat Response
Standard conversational response for web interface:
```javascript
{
  "response": "Generated response text",
  "service_used": "gemini",
  "processing_time": 1.2,
  "tokens_used": 150
}
```

### WhatsApp Response
Mobile-optimized response with emoji and concise formatting:
```javascript
{
  "response": "Hi John! 👋 Here's your answer...",
  "service_used": "groq",
  "processing_time": 0.8,
  "character_count": 245
}
```

### Query Optimization
Improved search query for better document retrieval:
```javascript
{
  "original_query": "How do I train a model?",
  "optimized_query": "machine learning model training deep learning neural networks",
  "service_used": "gemini",
  "processing_time": 0.5
}
```

## Error Handling

The service handles various error conditions:

- **Missing API Keys**: Returns 503 with service unavailable
- **Invalid Requests**: Returns 400 with validation errors
- **AI Service Errors**: Returns 500 with detailed error messages
- **Rate Limiting**: Returns 429 when limits exceeded
- **Timeout Errors**: Returns 504 for slow responses

## Performance Considerations

### Response Times
- **Groq**: 0.5-2 seconds (typically faster)
- **Gemini**: 1-3 seconds (varies by model)

### Rate Limits
- **Groq**: Varies by plan (check Groq documentation)
- **Gemini**: 60 requests per minute (free tier)

### Memory Usage
- Base service: ~30MB
- Per request: ~1-5MB
- Total: ~50MB for typical usage

## Security Features

- **API Key Protection**: Keys stored as environment variables
- **Request Validation**: Input sanitization and validation
- **CORS Configuration**: Controlled cross-origin access
- **Rate Limiting**: Prevents abuse and manages costs
- **Error Sanitization**: Prevents sensitive data leakage

## Monitoring

The service provides:

- Health check endpoints for monitoring
- Performance metrics tracking
- Error rate monitoring
- Response time analytics
- Service availability status

## Troubleshooting

### Common Issues

1. **AI Service Not Available**
   - Check API keys are correctly set
   - Verify internet connectivity
   - Check service status pages

2. **Slow Response Times**
   - Try different models (Groq is typically faster)
   - Reduce max_tokens parameter
   - Check network latency

3. **Rate Limit Errors**
   - Implement request queuing
   - Upgrade API plan if needed
   - Use fallback service

4. **Poor Response Quality**
   - Adjust temperature parameter
   - Improve context quality
   - Try different models

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
2. Navigate to the ai-service directory
3. Copy `.env.example` to `.env`
4. Add your API keys to `.env`
5. Install dependencies: `npm install`
6. Start the service: `npm run dev`

### Testing

Test the service using the web interface or API endpoints:

```bash
# Test health endpoint
curl http://localhost:3002/health

# Test generation endpoint
curl -X POST http://localhost:3002/generate \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, world!", "service": "gemini"}'
```

### Adding New AI Services

1. Install the AI service SDK
2. Add initialization code in `server.js`
3. Create generation functions
4. Update health check endpoint
5. Add configuration options
6. Update the web interface

## Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Update documentation for new features
4. Test all endpoints before deployment
5. Consider performance and cost implications

## License

ISC License