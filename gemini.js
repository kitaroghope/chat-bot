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
    const context = Array.isArray(searchResults) && searchResults.length > 0
        ? searchResults.join('\n\n---\n\n')
        : "No relevant document excerpts available.";

    const prompt = `
You are a knowledgeable and helpful Bugema University staff member responding to a student.

User's question: "${userQuery}"

Below are some excerpts from internal documents that may help:

${context}

Instructions:
1. Answer the student's question confidently, as a member of staff from Bugema University.
2. You are not limited to the excerpts — only refer to them if they are helpful or contain specific details.
3. You may use your full knowledge about Bugema University, its programs, systems, structure, policies, or student life.
4. Your tone should be warm, respectful, and informative — as if you're guiding a student or fellow staff.
5. If you refer to an excerpt, briefly quote it or explain it naturally in your own words.
6. Be clear and helpful — your goal is to inform the user, not just summarize the documents.
7. If the excerpts are not useful, simply ignore them and answer from your own understanding.

Write your answer as a real person would — friendly, clear, and reliable.

Response:
`;

    try {
        const result = await this.model.generateContent(prompt);
        const response = this.extractText(result);

        return response || "I'm happy to help, but I may need a bit more context to answer fully.";
    } catch (error) {
        console.error('⚠️ Response generation failed:', error.message);
        return `I'm available to help, but I encountered an issue processing this. Here’s what I found:\n\n${searchResults.join('\n\n')}`;
    }
}

}

export default GeminiService;
