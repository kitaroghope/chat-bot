# AI-Powered Chat Bot with WhatsApp Integration

A sophisticated chatbot that combines document search capabilities with AI-powered responses, available through both web interface and WhatsApp Business API.

## Live Demo

**The full application is deployed and live at:** [https://full-chatbot.code.ug/](https://full-chatbot.code.ug/)

## Two Versions Available

This repository contains two versions of the chatbot:

### 1. Full App (Root Directory)
The complete monolithic application deployed at the URL above. This version is customized as a **Bugema University Assistant** - an AI that answers questions about Bugema University, its programs, policies, and student life.

### 2. Modular Version (`new_modules/`)
A microservices architecture version with 6 independent services:
- API Gateway (Port 3000)
- Document Service (Port 3001)
- AI Service (Port 3002)
- WhatsApp Service (Port 3003)
- Web Interface (Port 3004)
- Database Service (Port 3005)

To use the modular version, see [`new_modules/README.md`](./new_modules/README.md).

> **Note:** The bot is customized in `gemini.js` to act as a Bugema University staff member. You can modify this persona to serve any institution or use case.

## 🚀 Features

### Core Functionality
- **Document Upload & Processing**: Upload PDF documents for intelligent Q&A
- **Vector Search**: Advanced semantic search through uploaded documents
- **AI-Powered Responses**: Enhanced responses using Gemini and Groq AI models
- **Real-time Chat**: WebSocket-based real-time communication
- **Multi-Platform**: Web interface + WhatsApp Business API integration

### WhatsApp Integration
- **📱 WhatsApp Business API**: Full integration with WhatsApp messaging
- **🔍 Document Search**: Users can ask questions about uploaded documents via WhatsApp
- **🤖 AI Responses**: Intelligent responses powered by Groq and Gemini AI
- **📄 Context-Aware**: Provides relevant information from your document library
- **⚡ Real-time**: Instant responses to WhatsApp messages

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **AI Services**: Google Gemini AI, Groq AI
- **Vector Search**: Transformers.js for embeddings
- **Database**: SQLite for document storage
- **Real-time**: Socket.IO
- **WhatsApp**: Meta WhatsApp Business API
- **Document Processing**: PDF parsing and chunking

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chat-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .example.env .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   # AI Services
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   
   # WhatsApp Business API
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
   WHATSAPP_VERIFY_TOKEN=your_verify_token_here
   WHATSAPP_APP_SECRET=your_app_secret_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Web Interface: `http://localhost:3001`
   - WhatsApp Status: `http://localhost:3001/whatsapp/status`

## 📱 WhatsApp Setup

For detailed WhatsApp Business API setup instructions, see [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md).

### Quick Setup:
1. Create a WhatsApp Business app on Meta for Developers
2. Get your access token and phone number ID
3. Configure webhook URL: `https://your-domain.com/webhook/whatsapp`
4. Update environment variables
5. Test with a message to your WhatsApp Business number

## 🎯 Usage

### Web Interface
1. **Upload Documents**: Drag and drop PDF files
2. **Ask Questions**: Type questions about your documents
3. **Get AI Responses**: Receive intelligent, context-aware answers

### WhatsApp
1. **Send Messages**: Text your WhatsApp Business number
2. **Ask About Documents**: Questions are automatically searched against uploaded PDFs
3. **Receive Answers**: Get concise, relevant responses with document context

## 🔧 API Endpoints

### Document Management
- `POST /upload` - Upload PDF documents
- `POST /chat` - Chat with document context

### WhatsApp Integration
- `GET /webhook/whatsapp` - Webhook verification
- `POST /webhook/whatsapp` - Receive WhatsApp messages
- `GET /whatsapp/status` - Check WhatsApp configuration
- `POST /whatsapp/send` - Send test messages

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │    │  WhatsApp Users  │    │   PDF Upload    │
└─────────┬───────┘    └────────┬─────────┘    └─────────┬───────┘
          │                     │                        │
          ▼                     ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express.js Server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Socket.IO │  │  WhatsApp   │  │    Document Processor   │ │
│  │   Handler   │  │   Webhook   │  │   (PDF → Chunks →       │ │
│  │             │  │   Handler   │  │    Vector Embeddings)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Gemini    │ │    Groq     │ │   SQLite    │
│     AI      │ │     AI      │ │  Database   │
└─────────────┘ └─────────────┘ └─────────────┘
```

## 🔍 How It Works

### Document Processing
1. **Upload**: PDFs are uploaded and parsed
2. **Chunking**: Documents are split into semantic chunks
3. **Embedding**: Each chunk gets a vector embedding
4. **Storage**: Chunks and embeddings stored in SQLite

### Query Processing
1. **Query Optimization**: AI optimizes user questions
2. **Vector Search**: Find relevant document chunks
3. **Context Generation**: Combine relevant chunks
4. **AI Response**: Generate human-like responses with context

### WhatsApp Integration
1. **Message Received**: WhatsApp webhook triggers
2. **Document Search**: Query processed against document library
3. **AI Enhancement**: Response generated with document context
4. **Reply Sent**: Contextual answer sent back to user

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
1. Set up proper environment variables
2. Configure HTTPS for WhatsApp webhooks
3. Set up process management (PM2, Docker, etc.)
4. Configure reverse proxy (Nginx, Apache)

## 🔒 Security

- Environment variables for sensitive data
- Webhook signature verification for WhatsApp
- Input validation and sanitization
- Rate limiting (recommended for production)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

- Check [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) for WhatsApp-specific issues
- Review console logs for debugging information
- Ensure all environment variables are properly configured

## 🔮 Future Enhancements

- [ ] Support for more document formats (Word, Excel, etc.)
- [ ] Multi-language support
- [ ] Voice message support for WhatsApp
- [ ] Advanced analytics and reporting
- [ ] Integration with more AI models
- [ ] Conversation memory and context persistence
