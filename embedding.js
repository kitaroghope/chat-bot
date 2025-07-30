import { pipeline } from '@xenova/transformers';

class Embedding {
    static instance = null;

    static async getInstance() {
        if (this.instance === null) {
            this.instance = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        return this.instance;
    }
}

export default Embedding;