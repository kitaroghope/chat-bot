# Troubleshooting Guide

This guide helps resolve common issues when running the Chat Bot microservices.

## 🚨 Common Issues

### 1. Services Show "Unhealthy" Status

**Symptoms:**
- API Gateway shows services as "unhealthy"
- Document service shows database as "inactive" 
- Services can't communicate with each other

**Solutions:**

#### Fix 1: Install Missing Dependencies
```bash
# Install all dependencies at once
node install-all-dependencies.js

# Or install manually for each service
cd database-service && npm install && cd ..
cd document-service && npm install && cd ..
cd ai-service && npm install && cd ..
cd whatsapp-service && npm install && cd ..
cd web-interface && npm install && cd ..
cd api-gateway && npm install && cd ..
```

#### Fix 2: Start Services in Correct Order
Services must start in dependency order:

```bash
# 1. Database service first (all others depend on it)
cd database-service
npm start

# Wait for database to be ready, then start others
cd ../document-service && npm start &
cd ../ai-service && npm start &
cd ../whatsapp-service && npm start &
cd ../web-interface && npm start &
cd ../api-gateway && npm start &
```

#### Fix 3: Check Port Conflicts
Default ports:
- Database Service: 3005
- Document Service: 3001  
- AI Service: 3002
- WhatsApp Service: 3003
- Web Interface: 3004
- API Gateway: 3000

```bash
# Check what's running on ports
netstat -an | findstr ":3000"
netstat -an | findstr ":3001"
netstat -an | findstr ":3002"
netstat -an | findstr ":3003"
netstat -an | findstr ":3004"
netstat -an | findstr ":3005"

# Kill processes on ports if needed
npx kill-port 3000 3001 3002 3003 3004 3005
```

### 2. Database Connection Issues

**Symptoms:**
- "Database request failed" errors
- Services timeout when connecting to database
- Document service shows database as "inactive"

**Solutions:**

#### Check Database Service
```bash
# Test database service health directly
curl http://localhost:3005/health

# Check database service logs
cd database-service
npm start
# Look for database connection errors
```

#### Fix Environment Variables
```bash
# In database-service/.env
DATABASE_URL=your_database_connection_string
PORT=3005

# In other services' .env files
DATABASE_SERVICE_URL=http://localhost:3005
```

#### Fix Database Client Issues
The services use axios to connect to the database service. Make sure axios is installed:

```bash
cd document-service && npm install axios
cd ../ai-service && npm install axios  
cd ../whatsapp-service && npm install axios
cd ../web-interface && npm install axios
```

### 3. AI Service Issues

**Symptoms:**
- "No AI services available" errors
- AI service shows as unhealthy
- Chat responses fail

**Solutions:**

#### Configure API Keys
```bash
# In ai-service/.env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
DATABASE_SERVICE_URL=http://localhost:3005
```

#### Test AI Service
```bash
# Test AI service health
curl http://localhost:3002/health

# Test AI generation
curl -X POST http://localhost:3002/generate \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "service": "gemini"}'
```

### 4. WhatsApp Service Issues

**Symptoms:**
- WhatsApp webhook fails
- Messages not being processed
- "WhatsApp service not initialized" errors

**Solutions:**

#### Configure WhatsApp Credentials
```bash
# In whatsapp-service/.env
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
AI_SERVICE_URL=http://localhost:3002
DOCUMENT_SERVICE_URL=http://localhost:3001
```

#### Test WhatsApp Service
```bash
# Test WhatsApp service health
curl http://localhost:3003/health

# Test webhook verification
curl "http://localhost:3003/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test"
```

### 5. Document Service Issues

**Symptoms:**
- PDF uploads fail
- "Embedding model not loaded" errors
- Vector search not working

**Solutions:**

#### Wait for Model Loading
The document service needs time to download the embedding model on first run:

```bash
cd document-service
npm start
# Wait for "Embedding model loaded successfully" message
```

#### Check Dependencies
```bash
cd document-service
npm install @xenova/transformers pdf-parse axios multer
```

#### Test Document Service
```bash
# Test document service health
curl http://localhost:3001/health

# Should show: "embedding_model": "loaded"
```

### 6. API Gateway Issues

**Symptoms:**
- Services can't be reached through gateway
- Circuit breaker errors
- Socket.IO issues

**Solutions:**

#### Check Service URLs
```bash
# In api-gateway/.env
DOCUMENT_SERVICE_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:3002
WHATSAPP_SERVICE_URL=http://localhost:3003
WEB_SERVICE_URL=http://localhost:3004
DATABASE_SERVICE_URL=http://localhost:3005
```

#### Install Missing Dependencies
```bash
cd api-gateway
npm install socket.io form-data
```

## 🔧 Health Check Commands

### Check All Services
```bash
# API Gateway health (shows all services)
curl http://localhost:3000/health

# Individual service health checks
curl http://localhost:3001/health  # Document Service
curl http://localhost:3002/health  # AI Service  
curl http://localhost:3003/health  # WhatsApp Service
curl http://localhost:3004/health  # Web Interface
curl http://localhost:3005/health  # Database Service
```

### Expected Healthy Responses

**API Gateway:**
```json
{
  "status": "healthy",
  "services": {
    "document": "healthy",
    "ai": "healthy", 
    "whatsapp": "healthy",
    "web": "healthy",
    "database": "healthy"
  }
}
```

**Database Service:**
```json
{
  "status": "healthy",
  "service": "database-service",
  "database": "connected"
}
```

**Document Service:**
```json
{
  "status": "healthy",
  "embedding_model": "loaded",
  "dependencies": {
    "database_service": "healthy"
  }
}
```

## 🚀 Quick Fix Script

Create and run this script to fix common issues:

```bash
# fix-services.bat (Windows) or fix-services.sh (Linux/Mac)

# Kill any running processes on our ports
npx kill-port 3000 3001 3002 3003 3004 3005

# Install dependencies
node install-all-dependencies.js

# Start services in order with delays
cd database-service && start npm start
timeout /t 5 /nobreak
cd ../document-service && start npm start  
timeout /t 3 /nobreak
cd ../ai-service && start npm start
timeout /t 3 /nobreak
cd ../whatsapp-service && start npm start
timeout /t 3 /nobreak
cd ../web-interface && start npm start
timeout /t 3 /nobreak
cd ../api-gateway && start npm start
```

## 📞 Getting Help

If issues persist:

1. **Check the console logs** of each service for detailed error messages
2. **Verify environment variables** are set correctly
3. **Ensure all dependencies are installed** using the install script
4. **Test services individually** before running through the API gateway
5. **Check network connectivity** between services

## 🔍 Debug Mode

Enable detailed logging:

```bash
# Set environment variable for detailed logs
NODE_ENV=development

# Or add to each service's .env file
DEBUG=*
```

This will show detailed connection attempts and error messages to help identify the root cause of issues.