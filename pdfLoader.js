import fs from 'fs';
async function extractTextFromPDF(path) {
    const { default: pdf } = await import('pdf-parse');
    const dataBuffer = fs.readFileSync(path);
    const data = await pdf(dataBuffer);
    return data.text;
}

export default extractTextFromPDF;