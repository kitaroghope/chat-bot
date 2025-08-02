# Document Processing Service

The Document Processing Service handles PDF upload, text extraction, chunking, embedding generation, and vector similarity search for the chat-bot microservices architecture.

## Features

- **PDF Processing**: Extract text from PDF documents
- **Text Chunking**: Split documents into manageable chunks
- **Vector Embeddings**: Generate embeddings using Xenova/all-MiniLM-L6-v2
- **Similarity Search**: Find relevant document chunks using cosine similarity
- **Document Management**: Upload, list, and delete documents
- **Configuration UI**: Web-based interface for managing documents and settings
- **PostgreSQL Integration**: Store documents and embeddings in PostgreSQL

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your actual configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database Configuration (Required)
DATABASE_URL=postgresql://username:password@hostname:port/database

# Security
SERVICE_API_KEY=your-secure-api-key-here

# Processing Configuration
MAX_FILE_SIZE=52428800
CHUNK_SIZE=500
MAX_CHUNKS_PER_DOCUMENT=1000
```

### 2. Database Setup

The service requires PostgreSQL with the following tables (auto-created on startup):

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
    embedding TEXT NOT NULL,
    chunk_index INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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

Access the configuration interface at: `http://localhost:3001`

The interface provides:

- **Service Status**: Real-time monitoring of embedding model and database
- **Document Upload**: Drag-and-drop PDF upload with progress tracking
- **Search Interface**: Test document search functionality
- **Document Management**: View, manage, and delete uploaded documents
- **Configuration**: Update processing settings

## API Endpoints

### Health Check
```http
GET /health
```
Returns service health status including database connection and embedding model status.

### Process Document
```http
POST /process-document
Content-Type: application/json

{
  "file_data": "base64_encoded_pdf_content",
  "filename": "document.pdf"
}
```

### Search Documents
```http
POST /search
Content-Type: application/json

{
  "query": "search query",
  "top_k": 3,
  "threshold": 0.0
}
```

### Get Statistics
```http
GET /stats
```

### List Documents
```http
GET /documents
```

### Delete Document
```http
DELETE /documents/:id
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
4. Select the `new_modules/document-service` folder as the root directory

### 2. Configure Build Settings

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18 or higher

### 3. Environment Variables

Add these environment variables in Render dashboard:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `DATABASE_URL` | Your PostgreSQL connection string | Yes |
| `SERVICE_API_KEY` | Generate a secure random key | Yes |
| `MAX_FILE_SIZE` | `52428800` (50MB) | No |
| `CHUNK_SIZE` | `500` | No |

### 4. PostgreSQL Database

Create a PostgreSQL database on Render:
1. Go to "New" → "PostgreSQL"
2. Choose a name and region
3. Copy the connection string to `DATABASE_URL`

## Processing Pipeline

### 1. PDF Upload
- Accepts base64-encoded PDF data
- Validates file size and format
- Extracts text using pdf-parse

### 2. Text Chunking
- Splits text into sentences
- Groups sentences into chunks (default: 500 characters)
- Maintains semantic boundaries

### 3. Embedding Generation
- Uses Xenova/all-MiniLM-L6-v2 model
- Generates 384-dimensional embeddings
- Normalizes vectors for cosine similarity

### 4. Storage
- Stores document metadata in `documents` table
- Stores chunks and embeddings in `vector_chunks` table
- Uses PostgreSQL for persistence

### 5. Search
- Generates query embedding
- Calculates cosine similarity with all stored chunks
- Returns top-k most similar results

## Performance Considerations

### Memory Usage
- Embedding model: ~100MB RAM
- Processing: ~50MB per document
- Total: ~200MB for typical usage

### Processing Time
- Small PDF (1-10 pages): 5-15 seconds
- Medium PDF (10-50 pages): 15-60 seconds
- Large PDF (50+ pages): 1-5 minutes

### Storage
- Text chunks: ~1KB per chunk
- Embeddings: ~1.5KB per chunk (384 floats)
- Total: ~2.5KB per chunk

## Error Handling

The service handles various error conditions:

- **Invalid file format**: Returns 400 with error message
- **File too large**: Returns 400 with size limit
- **Database connection**: Returns 500 with database error
- **Embedding model**: Returns 503 if model not loaded
- **Processing errors**: Returns 500 with detailed error

## Security Features

- **File validation**: Checks file type and size
- **API key authentication**: Secure inter-service communication
- **SQL injection protection**: Uses parameterized queries
- **CORS configuration**: Controlled cross-origin access

## Monitoring

The service provides:

- Health check endpoint for monitoring
- Document and chunk statistics
- Processing time tracking
- Error logging and reporting

## Troubleshooting

### Common Issues

1. **Embedding Model Not Loading**
   - Check available memory (needs ~100MB)
   - Verify internet connection for model download
   - Check disk space for model cache

2. **Database Connection Errors**
   - Verify DATABASE_URL is correct
   - Check PostgreSQL service is running
   - Ensure database exists and is accessible

3. **PDF Processing Failures**
   - Check file is valid PDF
   - Verify file size is under limit
   - Ensure PDF contains extractable text

4. **Search Not Working**
   - Verify documents are uploaded and processed
   - Check embedding model is loaded
   - Ensure database contains vector_chunks

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
2. Navigate to the document-service directory
3. Copy `.env.example` to `.env`
4. Set up PostgreSQL database
5. Update DATABASE_URL in `.env`
6. Install dependencies: `npm install`
7. Start the service: `npm run dev`

### Testing

Test the service using the web interface or API endpoints:

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test search endpoint
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "top_k": 3}'
```

### Adding New Features

1. Follow the existing code structure
2. Add proper error handling
3. Update the web interface if needed
4. Add API documentation
5. Test thoroughly before deployment

## Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Update documentation for new features
4. Test all endpoints before deployment
5. Consider performance implications

## License

ISC License