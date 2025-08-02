# Chat-Bot Microservices Setup Guide

This guide will help you set up and deploy all microservices for the chat-bot application on Render.com's free tier.

## 📋 Prerequisites

Before starting, ensure you have:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Git](https://git-scm.com/) installed
- A [Render.com](https://render.com) account
- API keys for:
  - [Groq](https://console.groq.com/) (optional)
  - [Google Gemini](https://makersuite.google.com/app/apikey) (optional)
  - [WhatsApp Business API](https://developers.facebook.com/) (optional)

## 🏗️ Architecture Overview

The application consists of 5 independent microservices:

1. **API Gateway** (`new_modules/api-gateway/`) - Main orchestrator
2. **Document Service** (`new_modules/document-service/`) - PDF processing and search
3. **AI Service** (`new_modules/ai-service/`) - Groq and Gemini integration
4. **WhatsApp Service** (`new_modules/whatsapp-service/`) - WhatsApp messaging
5. **Web Interface** (`new_modules/web-interface/`) - User interface

## 🚀 Quick Start (Local Development)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd chat-bot/new_modules

# Install dependencies for all services
cd api-gateway && npm install && cd ..
cd document-service && npm install && cd ..
cd ai-service && npm install && cd ..
cd whatsapp-service && npm install && cd ..
cd web-interface && npm install && cd ..
```

### 2. Configure Environment Variables

For each service, copy the `.env.example` to `.env` and configure:

```bash
# For each service directory
cp .env.example .env
# Edit .env with your actual values
```

### 3. Start Services Locally

Open 5 terminal windows and start each service:

```bash
# Terminal 1 - API Gateway
cd new_modules/api-gateway && npm start

# Terminal 2 - Document Service
cd new_modules/document-service && npm start

# Terminal 3 - AI Service
cd new_modules/ai-service && npm start

# Terminal 4 - WhatsApp Service
cd new_modules/whatsapp-service && npm start

# Terminal 5 - Web Interface
cd new_modules/web-interface && npm start
```

### 4. Access the Application

- **Web Interface**: http://localhost:3004
- **API Gateway Config**: http://localhost:3000
- **Document Service Config**: http://localhost:3001
- **AI Service Config**: http://localhost:3002
- **WhatsApp Service Config**: http://localhost:3003

## ☁️ Render.com Deployment

### Step 1: Create PostgreSQL Database

1. Go to [Render.com](https://render.com) dashboard
2. Click "New" → "PostgreSQL"
3. Choose a name (e.g., `chatbot-database`)
4. Select the free tier
5. Copy the connection string for later use

### Step 2: Deploy Services in Order

Deploy services in this specific order to ensure proper dependencies:

#### 1. Document Service (First - needs database)

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. **Root Directory**: `new_modules/document-service`
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. **Environment Variables**:
   ```
   NODE_ENV=production
   DATABASE_URL=<your-postgresql-connection-string>
   SERVICE_API_KEY=<generate-random-key>
   ```
7. Deploy and note the service URL

#### 2. AI Service (Second)

1. Click "New" → "Web Service"
2. **Root Directory**: `new_modules/ai-service`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   ```
   NODE_ENV=production
   GROQ_API_KEY=<your-groq-key>
   GEMINI_API_KEY=<your-gemini-key>
   DEFAULT_AI_SERVICE=gemini
   SERVICE_API_KEY=<generate-random-key>
   ```
6. Deploy and note the service URL

#### 3. WhatsApp Service (Third)

1. Click "New" → "Web Service"
2. **Root Directory**: `new_modules/whatsapp-service`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   ```
   NODE_ENV=production
   WHATSAPP_ACCESS_TOKEN=<your-whatsapp-token>
   WHATSAPP_VERIFY_TOKEN=<your-verify-token>
   WHATSAPP_APP_SECRET=<your-app-secret>
   WHATSAPP_PHONE_NUMBER_ID=<your-phone-id>
   AI_SERVICE_URL=<your-ai-service-url>
   DOCUMENT_SERVICE_URL=<your-document-service-url>
   SERVICE_API_KEY=<generate-random-key>
   ```
6. Deploy and note the service URL

#### 4. API Gateway (Fourth - orchestrates others)

1. Click "New" → "Web Service"
2. **Root Directory**: `new_modules/api-gateway`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   ```
   NODE_ENV=production
   DOCUMENT_SERVICE_URL=<your-document-service-url>
   AI_SERVICE_URL=<your-ai-service-url>
   WHATSAPP_SERVICE_URL=<your-whatsapp-service-url>
   DATABASE_URL=<your-postgresql-connection-string>
   SERVICE_API_KEY=<generate-random-key>
   ```
6. Deploy and note the service URL

#### 5. Web Interface (Last - needs gateway)

1. Click "New" → "Web Service"
2. **Root Directory**: `new_modules/web-interface`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   ```
   NODE_ENV=production
   API_GATEWAY_URL=<your-api-gateway-url>
   DOCUMENT_SERVICE_URL=<your-document-service-url>
   AI_SERVICE_URL=<your-ai-service-url>
   WHATSAPP_SERVICE_URL=<your-whatsapp-service-url>
   SERVICE_API_KEY=<generate-random-key>
   ```
6. Deploy and note the service URL

### Step 3: Configure Service URLs

After all services are deployed:

1. Visit each service's configuration interface
2. Update the service URLs to point to the actual Render.com URLs
3. Test the connections using the built-in test tools

## 🔧 Configuration

### API Keys Setup

#### Groq API Key
1. Visit [Groq Console](https://console.groq.com/)
2. Create account and generate API key
3. Add to AI Service environment variables

#### Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Add to AI Service environment variables

#### WhatsApp Business API
1. Create Facebook Developer account
2. Set up WhatsApp Business API app
3. Get Access Token, Phone Number ID, App Secret
4. Add to WhatsApp Service environment variables

### Database Setup

The PostgreSQL database will be automatically initialized with required tables when the Document Service starts.

Required tables:
- `documents` - Document metadata
- `vector_chunks` - Text chunks with embeddings

## 📊 Resource Usage (Render.com Free Tier)

| Service | RAM | Storage | Build Time | Monthly Hours |
|---------|-----|---------|------------|---------------|
| API Gateway | 256MB | 1GB | 5 min | 150h |
| Document Service | 512MB | 2GB | 15 min | 150h |
| AI Service | 256MB | 1GB | 5 min | 150h |
| WhatsApp Service | 256MB | 1GB | 5 min | 150h |
| Web Interface | 128MB | 512MB | 3 min | 150h |
| **Total** | **1.4GB** | **6.5GB** | **33 min** | **750h** |

✅ **Fits within Render.com free tier limits:**
- 750 hours/month shared across services
- 512MB RAM per service
- 90 minutes build time/month total
- 1GB PostgreSQL storage

## 🧪 Testing

### Local Testing

1. Start all services locally
2. Visit http://localhost:3004
3. Upload a PDF document
4. Ask questions about the document
5. Test WhatsApp integration (if configured)

### Production Testing

1. Visit your Web Interface URL
2. Test chat functionality
3. Test file upload
4. Check all service configuration interfaces
5. Monitor service health

## 🔍 Monitoring

Each service provides:

- **Health Check Endpoints**: `/health`
- **Configuration Interfaces**: Web-based management
- **Real-time Status**: Service connectivity monitoring
- **Error Logging**: Detailed error tracking

### Service URLs

After deployment, you'll have URLs like:
- Web Interface: `https://chatbot-web.onrender.com`
- API Gateway: `https://chatbot-gateway.onrender.com`
- Document Service: `https://chatbot-docs.onrender.com`
- AI Service: `https://chatbot-ai.onrender.com`
- WhatsApp Service: `https://chatbot-whatsapp.onrender.com`

## 🐛 Troubleshooting

### Common Issues

1. **Service Won't Start**
   - Check environment variables are set
   - Verify build completed successfully
   - Check logs in Render dashboard

2. **Services Can't Connect**
   - Verify service URLs are correct
   - Check API keys are configured
   - Ensure services are deployed and running

3. **Database Connection Issues**
   - Verify DATABASE_URL is correct
   - Check PostgreSQL service is running
   - Ensure database exists

4. **File Upload Failures**
   - Check file size limits (50MB max)
   - Verify document service is running
   - Ensure embedding model loads successfully

### Getting Help

1. Check service logs in Render dashboard
2. Use configuration interfaces to test connections
3. Verify environment variables are set correctly
4. Check API key validity and quotas

## 🔄 Updates and Maintenance

### Updating Services

1. Push changes to your GitHub repository
2. Render will automatically redeploy changed services
3. Monitor deployment logs for any issues
4. Test functionality after deployment

### Monitoring Costs

- Monitor your Render dashboard for resource usage
- Services will sleep after 15 minutes of inactivity (free tier)
- First request after sleep may take 30-60 seconds to wake up

### Scaling

When you outgrow the free tier:
- Upgrade to paid plans for always-on services
- Add Redis for session storage
- Implement proper logging and monitoring
- Consider load balancing for high traffic

## 📚 Additional Resources

- [Render.com Documentation](https://render.com/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Socket.IO Documentation](https://socket.io/docs/)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)

## 🎉 Success!

Once all services are deployed and configured, you'll have a fully functional AI chat-bot with:

- ✅ Web interface for document upload and chat
- ✅ WhatsApp integration for mobile messaging
- ✅ AI-powered responses using Groq/Gemini
- ✅ Document search and context-aware answers
- ✅ Real-time chat with Socket.IO
- ✅ Configuration interfaces for easy management

Your chat-bot is now ready to help users understand and interact with their documents!