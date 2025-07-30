import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
    constructor() {
        // ✅ Security: Require environment variable
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('❌ Missing GEMINI_API_KEY environment variable.');
        }

        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
            // ✅ Security: Use secure connection
            secure: true,
            // ✅ Performance: Use caching for faster responses
            cache: true,
        });
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    /**
     * ✅ Utility to safely extract text from Gemini response
     */
    extractText(result) {
        try {
            return (
                result?.response?.text?.() ||
                result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
                ''
            ).trim();
        } catch {
            return '';
        }
    }

    /**
     * ✅ Optimize search query
     */
    async optimizeQuery(userQuery) {
        const prompt = `
You are a search query optimizer. Given a user's question, create an optimized search query that will find the most relevant information in a document database.

User question: "${userQuery}"

Instructions:
1. Extract the key concepts and terms
2. Consider synonyms and related terms
3. Make the query more specific and targeted
4. Return only the optimized search query, nothing else

Optimized search query:
`;

        try {
            const result = await this.model.generateContent(prompt);
            const optimized = this.extractText(result);

            return optimized || userQuery; // ✅ Fallback to original if no output
        } catch (error) {
            console.error('⚠️ Query optimization failed:', error.message);
            return userQuery;
        }
    }

    /**
     * ✅ Generate response based on document excerpts
     */
    async generateResponse(userQuery, searchResults) {
        if (!Array.isArray(searchResults) || searchResults.length === 0) {
            return "I couldn't find relevant information to answer that question.";
        }

        const context = searchResults.join('\n\n---\n\n');

        const prompt = `
You are a helpful AI assistant answering questions based on document content.

User's question: "${userQuery}"

Relevant document excerpts:
${context}

Instructions:
1. Answer the user's question using ONLY the information provided in the document excerpts.
2. DO NOT use external knowledge unless explicitly present in the excerpts.
3. Write in a natural, conversational tone as if you're a knowledgeable person explaining the topic.
4. If the information is insufficient, say clearly: "The provided documents don't contain enough information to answer this fully."
5. Use specific details and quotes from the excerpts when relevant.
6. Structure your response clearly with proper formatting.
7. Be concise but comprehensive.

Response:
`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = this.extractText(result);

            return response || "The provided documents don't contain enough information to answer this question.";
        } catch (error) {
            console.error('⚠️ Response generation failed:', error.message);
            return `I found some relevant information, but I'm having trouble processing it right now. Here's what I found:\n\n${searchResults.join('\n\n')}`;
        }
    }
}

export default GeminiService;
