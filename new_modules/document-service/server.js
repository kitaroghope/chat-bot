import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import { pipeline } from '@xenova/transformers';
import pdf from 'pdf-parse';
import DatabaseClient from './utils/DatabaseClient.js';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: 'uploads/' });

// Database client
const db = new DatabaseClient(process.env.DATABASE_SERVICE_URL || 'https://chat-bot-05.onrender.com');

// Store for active SSE connections
const sseConnections = new Map();

// Initialize embedding model
let embedder = null;
const initializeEmbedder = async () => {
    try {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Embedding model loaded successfully');
    } catch (error) {
        console.error('Failed to load embedding model:', error);
    }
};

// Middleware
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://chat-bot-04.onrender.com', 'https://chat-bot-00.onrender.com', 'https://chat-bot-01.onrender.com']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3004'],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"]
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Server-Sent Events endpoint for progress updates
app.get('/events/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Store connection
    sseConnections.set(sessionId, res);
    
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
    
    // Clean up on disconnect
    req.on('close', () => {
        sseConnections.delete(sessionId);
    });
});

// Helper function to send progress events
function sendProgressEvent(sessionId, event) {
    const connection = sseConnections.get(sessionId);
    if (connection) {
        connection.write(`data: ${JSON.stringify(event)}\n\n`);
    }
}

// Configuration frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const checkDeps = req.query.deps !== 'false';
        let databaseStatus = 'unknown';
        let documentsCount = 0;
        
        if (checkDeps) {
            // Check database dependency
            try {
                const dbStatus = await db.checkHealth();
                databaseStatus = dbStatus.status === 'healthy' ? 'healthy' : 'unhealthy';
                const documentsResult = await db.findAll('document', { limit: 1 });
                documentsCount = documentsResult.pagination?.total || 0;
            } catch (error) {
                console.warn('Database health check failed:', error.message);
                databaseStatus = 'unhealthy';
            }
        }

        const isHealthy = embedder && (!checkDeps || databaseStatus === 'healthy');
        
        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'degraded',
            embedding_model: embedder ? 'loaded' : 'not_loaded',
            dependencies: {
                database_service: databaseStatus
            },
            documents_count: documentsCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get configuration
app.get('/api/config', (req, res) => {
    res.json({
        database_service: process.env.DATABASE_SERVICE_URL || 'https://chat-bot-05.onrender.com',
        embedding_model: embedder ? 'loaded' : 'not_loaded',
        max_file_size: '50MB',
        supported_formats: ['PDF'],
        chunk_size: 500
    });
});

// Text chunking function
function chunkText(text, maxLength = 500) {
    const sentences = text.split(/(?<=[.?!])\s+/);
    const chunks = [];
    let current = "";

    for (const sentence of sentences) {
        if ((current + sentence).length > maxLength) {
            if (current) chunks.push(current.trim());
            current = sentence;
        } else {
            current += " " + sentence;
        }
    }

    if (current) chunks.push(current.trim());
    return chunks;
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Process document endpoint
app.post('/process-document', async (req, res) => {
    try {
        const { file_data, filename, session_id } = req.body;
        
        if (!file_data || !filename) {
            return res.status(400).json({ error: 'file_data and filename are required' });
        }

        if (!embedder) {
            return res.status(503).json({ error: 'Embedding model not loaded' });
        }

        const response = await processDocumentInternal(file_data, filename, session_id);
        res.json(response);

    } catch (error) {
        console.error('Document processing error:', error);
        if (req.body.session_id) {
            sendProgressEvent(req.body.session_id, {
                type: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        res.status(500).json({
            error: 'Failed to process document',
            details: error.message
        });
    }
});

// Search endpoint
app.post('/search', async (req, res) => {
    try {
        const { query, top_k = 3, threshold = 0.0 } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'query is required' });
        }

        if (!embedder) {
            return res.status(503).json({ error: 'Embedding model not loaded' });
        }

        // Generate query embedding
        const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(queryEmbedding.data);

        // Get all chunks from database
        const chunksResponse = await db.request('/api/documentchunk?limit=1000');
        const chunks = chunksResponse.data || [];

        // Calculate similarities
        const similarities = chunks.map(row => {
            // Parse the embedding from PostgreSQL vector format
            const embeddingStr = row.embedding.replace(/[\[\]]/g, '');
            const dbVector = embeddingStr.split(',').map(Number);
            const score = cosineSimilarity(queryVector, dbVector);
            
            return {
                text: row.chunk_text,
                score: score,
                document_id: row.document_id,
                chunk_id: row.id
            };
        });

        // Sort by similarity and filter by threshold
        const results = similarities
            .filter(item => item.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, top_k);

        res.json({
            results: results,
            query_time: 0 // Could add timing
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            details: error.message
        });
    }
});

// Get statistics
app.get('/stats', async (req, res) => {
    try {
        const documentsResponse = await db.request('/api/document');
        const chunksResponse = await db.request('/api/documentchunk');
        
        const totalDocuments = documentsResponse.pagination?.total || 0;
        const totalChunks = chunksResponse.pagination?.total || 0;
        
        // Get latest document if any exist
        let lastUpdated = null;
        if (totalDocuments > 0) {
            const latestDoc = documentsResponse.data?.[0];
            lastUpdated = latestDoc?.created_at || null;
        }

        res.json({
            total_documents: totalDocuments,
            total_chunks: totalChunks,
            database_size: 'N/A', // Could calculate actual size
            last_updated: lastUpdated
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            error: 'Failed to get statistics',
            details: error.message
        });
    }
});

// Delete document
app.delete('/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { session_id } = req.query;
        
        // Validate document ID
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid document ID provided' 
            });
        }
        
        console.log(`Starting deletion process for document ID: ${id}`);
        
        // Send initial deletion progress
        if (session_id) {
            sendProgressEvent(session_id, {
                type: 'progress',
                stage: 'deleting',
                message: 'Starting document deletion...',
                progress: 0,
                timestamp: new Date().toISOString()
            });
        }
        
        // Get document info first
        console.log(`Looking up document with ID: ${id}`);
        const document = await db.findById('document', id);
        console.log('Document lookup result:', document);
        
        if (!document) {
            return res.status(404).json({ 
                success: false,
                error: 'Document not found' 
            });
        }
        
        // Send progress update
        if (session_id) {
            sendProgressEvent(session_id, {
                type: 'progress',
                stage: 'deleting',
                message: `Found document: ${document.filename}`,
                progress: 20,
                timestamp: new Date().toISOString()
            });
        }
        
        // Get chunk count for progress tracking
        const chunksResponse = await db.findAll('documentchunk', { document_id: id });
        const chunks = chunksResponse.data || [];
        const totalChunks = chunks.length;
        
        if (session_id) {
            sendProgressEvent(session_id, {
                type: 'progress',
                stage: 'deleting',
                message: `Deleting ${totalChunks} chunks...`,
                progress: 40,
                current: 0,
                total: totalChunks,
                timestamp: new Date().toISOString()
            });
        }
        
        // Delete all chunks with matching document_id using deleteWhere
        console.log(`Deleting all chunks for document ID: ${id}`);
        const deleteResult = await db.deleteWhere('documentchunk', { document_id: id });
        console.log('Chunks deletion result:', deleteResult);
        console.log(`Successfully deleted chunks for document: ${id}`);
        
        if (session_id) {
            sendProgressEvent(session_id, {
                type: 'progress',
                stage: 'deleting',
                message: 'Chunks deleted successfully',
                progress: 80,
                timestamp: new Date().toISOString()
            });
        }
        
        // Delete document
        try {
            await db.delete('document', id);
            console.log('Document deleted:', id);
        } catch (docError) {
            console.error('Failed to delete document:', docError);
            throw new Error(`Failed to delete document: ${docError.message}`);
        }
        
        if (session_id) {
            sendProgressEvent(session_id, {
                type: 'completed',
                stage: 'deleted',
                message: `Document ${document.filename} deleted successfully`,
                progress: 100,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            message: `Document ${document.filename} deleted successfully`,
            chunks_deleted: totalChunks
        });

    } catch (error) {
        console.error('Delete error:', error);
        if (req.query.session_id) {
            sendProgressEvent(req.query.session_id, {
                type: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        res.status(500).json({
            error: 'Failed to delete document',
            details: error.message
        });
    }
});

// Upload PDF endpoint (matching app.js functionality)
app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!embedder) {
            return res.status(503).json({ error: 'Embedding model not loaded' });
        }

        const fs = await import('fs');
        const fileData = fs.readFileSync(req.file.path, { encoding: 'base64' });
        const sessionId = req.body.session_id || `upload_${Date.now()}`;

        // Process the document using the existing endpoint
        const response = await processDocumentInternal(fileData, req.file.originalname, sessionId);
        
        // Clean up temp file
        fs.unlinkSync(req.file.path);

        res.json(response);

    } catch (error) {
        console.error('Upload error:', error);
        if (req.body.session_id) {
            sendProgressEvent(req.body.session_id, {
                type: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        // Clean up temp file on error
        try {
            const fs = await import('fs');
            fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', cleanupError.message);
        }
        res.status(500).json({
            error: 'Failed to process uploaded document',
            details: error.message
        });
    }
});

// Internal function to process document (used by both endpoints)
async function processDocumentInternal(fileData, filename, sessionId = null) {
    const startTime = Date.now();
    
    try {
        // Send initial progress
        if (sessionId) {
            sendProgressEvent(sessionId, {
                type: 'progress',
                stage: 'parsing',
                message: 'Extracting text from PDF...',
                progress: 0,
                timestamp: new Date().toISOString()
            });
        }
        
        // Decode base64 file data
        const buffer = Buffer.from(fileData, 'base64');
        
        // Extract text from PDF
        const data = await pdf(buffer);
        const text = data.text;
        
        if (!text || text.trim().length === 0) {
            throw new Error('No text found in PDF');
        }

        // Send chunking progress
        if (sessionId) {
            sendProgressEvent(sessionId, {
                type: 'progress',
                stage: 'chunking',
                message: 'Splitting text into chunks...',
                progress: 20,
                timestamp: new Date().toISOString()
            });
        }

        // Chunk the text
        const chunks = chunkText(text);
        
        // Send database creation progress
        if (sessionId) {
            sendProgressEvent(sessionId, {
                type: 'progress',
                stage: 'database',
                message: 'Creating document record...',
                progress: 30,
                timestamp: new Date().toISOString()
            });
        }
        
        // Insert document record
        const document = await db.createDocument({
            filename: filename,
            original_filename: filename,
            file_path: `uploads/${filename}`,
            file_size: buffer.length,
            mime_type: 'application/pdf',
            status: 'processing',
            processed_content: text,
            metadata: JSON.stringify({
                text_length: text.length,
                chunk_count: chunks.length
            })
        });
        
        if (!document || !document.id) {
            throw new Error('Failed to create document - no ID returned');
        }
        
        const documentId = document.id;
        console.log('Document ID:', documentId);

        // Process chunks and generate embeddings
        for (let i = 0; i < chunks.length; i++) {
            const progressPercent = Math.round(40 + (i / chunks.length) * 50);
            
            if (sessionId) {
                sendProgressEvent(sessionId, {
                    type: 'progress',
                    stage: 'embedding',
                    message: `Processing chunk ${i + 1} of ${chunks.length}...`,
                    progress: progressPercent,
                    current: i + 1,
                    total: chunks.length,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`${i + 1}/${chunks.length}`);
            const chunk = chunks[i];
            const embedding = await embedder(chunk, { pooling: 'mean', normalize: true });
            const embeddingArray = Array.from(embedding.data);
            
            await db.createDocumentChunk({
                document_id: documentId,
                chunk_text: chunk,
                chunk_index: i,
                embedding: `[${embeddingArray.join(',')}]`, // PostgreSQL vector format
                metadata: JSON.stringify({
                    chunk_length: chunk.length,
                    embedding_model: 'all-MiniLM-L6-v2'
                })
            });
        }

        // Send completion progress
        if (sessionId) {
            sendProgressEvent(sessionId, {
                type: 'progress',
                stage: 'finalizing',
                message: 'Finalizing document...',
                progress: 95,
                timestamp: new Date().toISOString()
            });
        }

        // Update document status to completed
        await db.updateDocument(documentId, { status: 'completed' });
        
        const processingTime = Date.now() - startTime;
        
        // Send completion event
        if (sessionId) {
            sendProgressEvent(sessionId, {
                type: 'completed',
                stage: 'completed',
                message: 'Document processing completed successfully',
                progress: 100,
                document_id: documentId,
                chunks_created: chunks.length,
                processing_time: processingTime,
                timestamp: new Date().toISOString()
            });
        }

        return {
            success: true,
            document_id: documentId,
            chunks_created: chunks.length,
            processing_time: processingTime,
            text_length: text.length
        };
        
    } catch (error) {
        if (sessionId) {
            sendProgressEvent(sessionId, {
                type: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
        throw error;
    }
}

// List documents
app.get('/documents', async (req, res) => {
    try {
        console.log('Attempting to load documents from database...');
        const documentsResponse = await db.findAll('document', { limit: 1000 });
        console.log('Database response:', documentsResponse);
        
        const documents = documentsResponse.data || [];
        console.log(`Successfully loaded ${documents.length} documents`);
        
        res.json({
            success: true,
            documents: documents,
            count: documents.length
        });

    } catch (error) {
        console.error('List documents error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to list documents',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Check database service health
async function checkDatabaseService() {
    try {
        const health = await db.checkHealth();
        console.log('Database service status:', health.status);
        return health.status === 'healthy';
    } catch (error) {
        console.error('Database service check failed:', error.message);
        return false;
    }
}

// Start server
async function startServer() {
    await checkDatabaseService();
    await initializeEmbedder();
    
    app.listen(port, () => {
        console.log(`Document service running on port ${port}`);
        console.log(`Configuration UI: http://localhost:${port}`);
        console.log(`Database service URL: ${process.env.DATABASE_SERVICE_URL || 'https://chat-bot-05.onrender.com'}`);
    });
}

startServer();