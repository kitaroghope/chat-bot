import Embedding from './embedding.js';
import chunkText from './chunker.js';
import extractTextFromPDF from './pdfLoader.js';
import { initDatabase, getDb, getVectors, getDialect } from './db/index.js';

async function addDocument(filePath, progressCallback) {
    // Ensure DB is initialized
    await initDatabase();
    const db = getDb();
    const vectors = getVectors();
    const dialect = getDialect();

    console.log(`Starting PDF processing for: ${filePath}`);
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

        if (vectors) {
            if (dialect === 'sqlite') {
                // better-sqlite3 is sync
                db.insert(vectors).values({ text: chunk, vector });
            } else {
                // PostgreSQL and others are async
                await db.insert(vectors).values({ text: chunk, vector });
            }
        }
        console.log(`Chunk ${i + 1} embedded and stored`);
    }

    progressCallback?.({ stage: 'complete', message: 'Processing complete!', percent: 100 });
    console.log(`Document processing complete: ${chunks.length} chunks processed`);
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
    const vectors = getVectors();
    const dialect = getDialect();

    const embedder = await Embedding.getInstance();
    const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryEmbedding.data);

    let allVectors;
    if (vectors) {
        if (dialect === 'sqlite') {
            // better-sqlite3 is sync
            allVectors = db.select().from(vectors).all();
        } else {
            // PostgreSQL and others are async - use await without .all()
            allVectors = await db.select().from(vectors);
        }
    } else {
        // MongoDB fallback - use raw collection
        const collection = db.mongoClient.db('chatbot').collection('vectors');
        allVectors = await collection.find({}).toArray();
    }

    const similarities = allVectors.map(row => {
        const dbVector = typeof row.vector === 'string' ? JSON.parse(row.vector) : row.vector;
        return {
            text: row.text,
            score: cosineSimilarity(queryVector, dbVector)
        };
    });

    const sorted = similarities.sort((a, b) => b.score - a.score);
    return sorted.slice(0, topK).map(r => r.text);
}

export { addDocument, findSimilar };
