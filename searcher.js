import path from 'path';
import Embedding from './embedding.js';
import chunkText from './chunker.js';
import extractTextFromPDF from './pdfLoader.js';
import { initDatabase, getDb, getVectors, getDialect, getDocuments as getDocumentsTable, getVectorChunks } from './db/index.js';
import { eq, asc, sql } from 'drizzle-orm';

async function addDocument(filePath, filename, progressCallback) {
    // Ensure DB is initialized
    await initDatabase();
    const db = getDb();
    const dialect = getDialect();
    const documentsTable = getDocumentsTable();
    const vectorChunksTable = getVectorChunks();

    if (!documentsTable || !vectorChunksTable) {
        throw new Error('Document tables not available');
    }

    console.log(`Starting PDF processing for: ${filename}`);
    progressCallback?.({ stage: 'extracting', message: 'Extracting text from PDF...', percent: 0 });

    const text = await extractTextFromPDF(filePath);
    console.log(`Extracted text length: ${text.length} characters`);
    progressCallback?.({ stage: 'chunking', message: 'Splitting text into chunks...', percent: 10 });

    const chunks = chunkText(text);
    console.log(`Split into ${chunks.length} chunks`);
    progressCallback?.({ stage: 'loading', message: 'Loading embedding model...', percent: 20 });

    console.log('Loading embedding model...');
    const embedder = await Embedding.getInstance();
    console.log('Embedding model loaded successfully');
    progressCallback?.({ stage: 'processing', message: 'Processing chunks...', percent: 30 });

    // Create document record first
    let documentId;
    if (dialect === 'sqlite') {
        const result = db.insert(documentsTable).values({
            filename: filename,
            textLength: text.length,
            chunkCount: chunks.length
        });
        documentId = result.lastInsertRowid;
    } else {
        // PostgreSQL
        const result = await db.insert(documentsTable).values({
            filename: filename,
            textLength: text.length,
            chunkCount: chunks.length
        }).returning({ id: documentsTable.id });
        documentId = result[0].id;
    }

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
        const progressPercent = 30 + Math.floor((i / chunks.length) * 70);
        progressCallback?.({
            stage: 'processing',
            message: `Processing chunk ${i + 1}/${chunks.length}...`,
            percent: progressPercent,
            current: i + 1,
            total: chunks.length
        });

        console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
        const chunk = chunks[i];
        const embedding = await embedder(chunk, { pooling: 'mean', normalize: true });
        const vector = JSON.stringify(Array.from(embedding.data));

        if (dialect === 'sqlite') {
            db.insert(vectorChunksTable).values({
                documentId: documentId,
                chunkText: chunk,
                embedding: vector,
                chunkIndex: i,
                document: filename
            });
        } else {
            await db.insert(vectorChunksTable).values({
                documentId: documentId,
                chunkText: chunk,
                embedding: vector,
                chunkIndex: i,
                document: filename
            });
        }
        console.log(`Chunk ${i + 1} embedded and stored`);
    }

    progressCallback?.({ stage: 'complete', message: 'Processing complete!', percent: 100 });
    console.log(`Document processing complete: ${chunks.length} chunks processed`);
    return { filename, chunkCount: chunks.length, documentId };
}

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

async function findSimilar(query, topK = 3) {
    // Ensure DB is initialized
    await initDatabase();
    const db = getDb();
    const vectorChunksTable = getVectorChunks();
    const dialect = getDialect();

    if (!vectorChunksTable) {
        console.warn('Vector chunks table not available');
        return [];
    }

    const embedder = await Embedding.getInstance();
    const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryEmbedding.data);

    let allChunks;
    if (dialect === 'sqlite') {
        allChunks = db.select().from(vectorChunksTable).all();
    } else {
        allChunks = await db.select().from(vectorChunksTable);
    }

    const similarities = allChunks.map(row => {
        const dbVector = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
        return {
            text: row.chunkText,
            score: cosineSimilarity(queryVector, dbVector)
        };
    });

    const sorted = similarities.sort((a, b) => b.score - a.score);
    return sorted.slice(0, topK).map(r => r.text);
}

async function getDocuments() {
    await initDatabase();
    const db = getDb();
    const dialect = getDialect();
    const documentsTable = getDocumentsTable();
    const vectorChunksTable = getVectorChunks();

    if (!documentsTable || !vectorChunksTable) {
        return [];
    }

    if (dialect === 'sqlite') {
        // Get all documents
        const allDocs = db.select().from(documentsTable).all();
        // Get chunk counts per document
        console.log(allDocs)
        const chunkCounts = db.select({ documentId: vectorChunksTable.documentId, count: sql`count(*)`.as('count') })
            .from(vectorChunksTable)
            .groupBy(vectorChunksTable.documentId)
            .all();

        const chunkCountMap = {};
        chunkCounts.forEach(row => {
            chunkCountMap[row.documentId] = row.count;
        });

        return allDocs.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            upload_date: doc.uploadDate,
            text_length: doc.textLength,
            chunk_count: doc.chunkCount || doc.chunk_count || 0
        }));
    } else {
        // PostgreSQL - use subquery with count
        const result = await db.select({
            id: documentsTable.id,
            filename: documentsTable.filename,
            upload_date: documentsTable.uploadDate,
            text_length: documentsTable.textLength,
            chunk_count: documentsTable.chunkCount
        }).from(documentsTable);

        return result;
    }
}

async function deleteDocument(documentId) {
    await initDatabase();
    const db = getDb();
    const dialect = getDialect();
    const documentsTable = getDocumentsTable();
    const vectorChunksTable = getVectorChunks();

    if (!documentsTable || !vectorChunksTable) {
        throw new Error('Document tables not available');
    }

    // Delete document (cascades to vector_chunks due to foreign key)
    if (dialect === 'sqlite') {
        const result = db.delete(documentsTable).where(eq(documentsTable.id, documentId)).run();
        return result.changes;
    } else {
        const result = await db.delete(documentsTable).where(eq(documentsTable.id, documentId));
        return result.rowCount;
    }
}

export { addDocument, findSimilar, getDocuments, deleteDocument };
