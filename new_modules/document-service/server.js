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
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:3000',
    ssl: process.env.DATABASE_SSL ? { rejectUnauthorized: false } : false
});


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: 'uploads/' });

// Database client
const db = new DatabaseClient();

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
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const dbStatus = await db.checkHealth();
        const documentsCount = await db.request('/api/document?limit=1');
        
        res.json({
            status: 'healthy',
            embedding_model: embedder ? 'loaded' : 'not_loaded',
            database_service: dbStatus.status,
            documents_count: documentsCount.pagination?.total || 0,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get configuration
app.get('/api/config', (req, res) => {
    res.json({
        database_service: process.env.DATABASE_SERVICE_URL || 'http://localhost:3005',
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
        const { file_data, filename } = req.body;
        
        if (!file_data || !filename) {
            return res.status(400).json({ error: 'file_data and filename are required' });
        }

        if (!embedder) {
            return res.status(503).json({ error: 'Embedding model not loaded' });
        }

        // Decode base64 file data
        const buffer = Buffer.from(file_data, 'base64');
        
        // Extract text from PDF
        const data = await pdf(buffer);
        const text = data.text;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text found in PDF' });
        }

        // Chunk the text
        const chunks = chunkText(text);
        
        // Insert document record
        const document = await db.createDocument({
            filename: filename,
            original_filename: filename,
            file_path: `uploads/${filename}`,
            file_size: buffer.length,
            mime_type: 'application/pdf',
            status: 'processing',
            processed_content: text,
            metadata: {
                text_length: text.length,
                chunk_count: chunks.length
            }
        });
        
        const documentId = document.id;

        // Process chunks and generate embeddings
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await embedder(chunk, { pooling: 'mean', normalize: true });
            const embeddingArray = Array.from(embedding.data);
            
            await db.createDocumentChunk({
                document_id: documentId,
                chunk_text: chunk,
                chunk_index: i,
                embedding: `[${embeddingArray.join(',')}]`, // PostgreSQL vector format
                metadata: {
                    chunk_length: chunk.length,
                    embedding_model: 'all-MiniLM-L6-v2'
                }
            });
        }

        // Update document status to completed
        await db.updateDocument(documentId, { status: 'completed' });

        res.json({
            success: true,
            document_id: documentId,
            chunks_created: chunks.length,
            processing_time: 0, // Could add timing
            text_length: text.length
        });

    } catch (error) {
        console.error('Document processing error:', error);
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
        const documentsResult = await pool.query('SELECT COUNT(*) FROM documents');
        const chunksResult = await pool.query('SELECT COUNT(*) FROM vector_chunks');
        const lastDocResult = await pool.query(
            'SELECT upload_date FROM documents ORDER BY upload_date DESC LIMIT 1'
        );

        res.json({
            total_documents: parseInt(documentsResult.rows[0].count),
            total_chunks: parseInt(chunksResult.rows[0].count),
            database_size: 'N/A', // Could calculate actual size
            last_updated: lastDocResult.rows[0]?.upload_date || null
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
        
        // Delete chunks first (foreign key constraint)
        await pool.query('DELETE FROM vector_chunks WHERE document_id = $1', [id]);
        
        // Delete document
        const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING filename', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({
            success: true,
            message: `Document ${result.rows[0].filename} deleted successfully`
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            error: 'Failed to delete document',
            details: error.message
        });
    }
});

// List documents
app.get('/documents', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, filename, upload_date, text_length, chunk_count FROM documents ORDER BY upload_date DESC'
        );

        res.json({
            documents: result.rows
        });

    } catch (error) {
        console.error('List documents error:', error);
        res.status(500).json({
            error: 'Failed to list documents',
            details: error.message
        });
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create documents table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                text_length INTEGER,
                chunk_count INTEGER
            )
        `);

        // Create vector_chunks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vector_chunks (
                id SERIAL PRIMARY KEY,
                document_id INTEGER REFERENCES documents(id),
                chunk_text TEXT NOT NULL,
                embedding TEXT NOT NULL,
                chunk_index INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Start server
async function startServer() {
    await initializeDatabase();
    await initializeEmbedder();
    
    app.listen(port, () => {
        console.log(`Document service running on port ${port}`);
        console.log(`Configuration UI: http://localhost:${port}`);
    });
}

startServer();