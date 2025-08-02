# WhatsApp Service

The WhatsApp Service handles WhatsApp Business API integration, webhook processing, message sending, and AI-powered response generation for the chat-bot microservices architecture.

## Features

- **WhatsApp Business API Integration**: Complete integration with WhatsApp Business API
- **Webhook Processing**: Secure webhook verification and message processing
- **AI-Powered Responses**: Integration with AI and document services for intelligent responses
- **Message Management**: Send text messages, template messages, and handle various message types
- **Configuration UI**: Web-based interface for managing WhatsApp settings and testing
- **Message Statistics**: Track sent/received messages and error rates
- **Security**: Webhook signature verification and secure credential management

## Setup Instructions

### 1. WhatsApp Business API Setup

#### Prerequisites
1. **WhatsApp Business Account**: Create a WhatsApp Business account
2. **Facebook Developer Account**: Set up a Facebook Developer account
3. **WhatsApp Business API Access**: Apply for WhatsApp Business API access

#### Get API Credentials
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add WhatsApp Business API product
4. Get the following credentials:
   - **Access Token**: From WhatsApp Business API settings
   - **Phone Number ID**: Your WhatsApp Business phone number ID
   - **App Secret**: From app settings
   - **Verify Token**: Create a custom token for webhook verification

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your actual WhatsApp credentials:

```env
# Server Configuration
PORT=3003
NODE_ENV=production

# WhatsApp Business API Configuration (Required)
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token-here
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token-here
WHATSAPP_APP_SECRET=your-app-secret-here
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id-here
WHATSAPP_API_VERSION=v18.0

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-service.onrender.com

# Service Integration URLs
AI_SERVICE_URL=https://your-ai-service.onrender.com
DOCUMENT_SERVICE_URL=https://your-document-service.onrender.com

# Security
SERVICE_API_KEY=your-secure-api-key-here
```

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

Access the configuration interface at: `http://localhost:3003`

The interface provides:

- **Service Status**: Real-time monitoring of message statistics
- **WhatsApp Configuration**: Manage API credentials and webhook settings
- **Service Integration**: Configure AI and document service URLs
- **Message Testing**: Send test messages and template messages
- **Setup Instructions**: Step-by-step WhatsApp Business API setup guide

## API Endpoints

### Health Check
```http
GET /health
```
Returns service health status and message statistics.

### Webhook Verification (GET)
```http
GET /verify-webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```
Used by WhatsApp to verify webhook during setup.

### Webhook Handler (POST)
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
            ]
          }
        }
      ]
    }
  ]
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

### Send Template Message
```http
POST /send-template
Content-Type: application/json

{
  "to": "1234567890",
  "templateName": "hello_world",
  "languageCode": "en_US",
  "parameters": ["John"]
}
```

### Get Status
```http
GET /status
```

### Configuration Management
```http
GET /api/config
POST /api/config
```

## Deployment on Render.com

### 1. Create New Web Service

1. Go to [Render.com](https://render.com) dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `new_modules/whatsapp-service` folder as the root directory

### 2. Configure Build Settings

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18 or higher

### 3. Environment Variables

Add these environment variables in Render dashboard:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Your WhatsApp access token | Yes |
| `WHATSAPP_VERIFY_TOKEN` | Your webhook verify token | Yes |
| `WHATSAPP_APP_SECRET` | Your app secret | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | Your phone number ID | Yes |
| `WEBHOOK_BASE_URL` | Your Render service URL | Yes |
| `AI_SERVICE_URL` | Your AI service URL | Yes |
| `DOCUMENT_SERVICE_URL` | Your document service URL | Yes |
| `SERVICE_API_KEY` | Generate a secure random key | Yes |

### 4. Configure WhatsApp Webhook

1. Go to your Facebook Developer dashboard
2. Navigate to WhatsApp → Configuration
3. Set webhook URL to: `https://your-service.onrender.com/webhook`
4. Set verify token to match your `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to message events

## Message Processing Flow

### 1. Incoming Message
- WhatsApp sends webhook to `/webhook` endpoint
- Service verifies webhook signature for security
- Extracts message content and sender information

### 2. AI Response Generation
- **Query Optimization**: Uses AI service to optimize search query
- **Document Search**: Searches document service for relevant content
- **Response Generation**: Generates WhatsApp-optimized response using AI service
- **Fallback Handling**: Provides fallback responses if services are unavailable

### 3. Response Delivery
- Formats response for WhatsApp (length limits, emoji support)
- Sends response via WhatsApp Business API
- Marks original message as read
- Updates message statistics

## Message Types Supported

### Text Messages
- Processes user text messages
- Generates AI-powered responses
- Supports context from uploaded documents

### Template Messages
- Send pre-approved template messages
- Support for parameters and localization
- Useful for notifications and structured responses

### Other Message Types
- Handles images, documents, audio (with appropriate responses)
- Provides helpful messages for unsupported types

## Security Features

- **Webhook Signature Verification**: Validates all incoming webhooks
- **API Key Authentication**: Secure inter-service communication
- **CORS Configuration**: Controlled cross-origin access
- **Rate Limiting**: Prevents abuse and manages API quotas
- **Credential Protection**: Secure storage of sensitive tokens

## Error Handling

The service handles various error conditions:

- **Invalid Webhook Signatures**: Returns 403 Forbidden
- **Missing Credentials**: Returns appropriate error messages
- **API Rate Limits**: Handles WhatsApp API rate limiting
- **Service Unavailability**: Graceful degradation when AI/document services are down
- **Token Expiration**: Clear error messages for expired tokens

## Monitoring

The service provides:

- **Message Statistics**: Track sent, received, and error counts
- **Health Check Endpoint**: Monitor service availability
- **Real-time Status**: Live updates of service health
- **Error Logging**: Detailed error tracking and reporting

## Troubleshooting

### Common Issues

1. **Webhook Verification Failed**
   - Check verify token matches Facebook Developer settings
   - Ensure webhook URL is accessible from internet
   - Verify HTTPS is enabled (required by WhatsApp)

2. **Messages Not Sending**
   - Check access token is valid and not expired
   - Verify phone number ID is correct
   - Ensure recipient number is in correct format (+1234567890)

3. **Access Token Expired**
   - Tokens expire every 24 hours in development
   - Generate new token from Facebook Developer dashboard
   - Consider using permanent tokens for production

4. **AI Responses Not Working**
   - Check AI service URL is correct and accessible
   - Verify document service is running
   - Check service API keys are configured

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
2. Navigate to the whatsapp-service directory
3. Copy `.env.example` to `.env`
4. Add your WhatsApp credentials to `.env`
5. Install dependencies: `npm install`
6. Start the service: `npm run dev`

### Testing

Use the web interface for testing:

1. Access `http://localhost:3003`
2. Configure your WhatsApp credentials
3. Use the message testing tools
4. Monitor message statistics

### Webhook Testing

For local webhook testing, use tools like:
- **ngrok**: Create public tunnel to localhost
- **Render Preview**: Use preview deployments
- **Postman**: Test webhook endpoints manually

## WhatsApp Business API Limits

### Free Tier Limits
- **1,000 conversations per month**
- **Rate limits**: 80 messages per second
- **Template messages**: Limited approval process

### Production Considerations
- **Business Verification**: Required for higher limits
- **Template Approval**: Templates must be approved by WhatsApp
- **Phone Number Verification**: Business phone number verification required

## Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Update documentation for new features
4. Test all endpoints before deployment
5. Consider WhatsApp API guidelines and limits

## License

ISC License