#!/usr/bin/env node

import axios from 'axios';

const DOCUMENT_SERVICE_URL = 'http://localhost:3001';

async function testDocumentDeletion() {
    console.log('🧪 Testing Document Deletion Functionality...\n');
    
    try {
        // First, check if service is running
        console.log('1. Checking document service health...');
        const healthResponse = await axios.get(`${DOCUMENT_SERVICE_URL}/health`);
        console.log('✅ Document service is running\n');
        
        // Get list of documents
        console.log('2. Fetching document list...');
        const documentsResponse = await axios.get(`${DOCUMENT_SERVICE_URL}/documents`);
        const documents = documentsResponse.data.documents || [];
        console.log(`📄 Found ${documents.length} documents`);
        
        if (documents.length === 0) {
            console.log('ℹ️  No documents to test deletion with');
            console.log('💡 Upload a document first, then run this test again');
            return;
        }
        
        // Show available documents
        console.log('\nAvailable documents:');
        documents.forEach((doc, index) => {
            console.log(`   ${index + 1}. ${doc.filename} (ID: ${doc.id})`);
        });
        
        // Test deletion with the first document (if user confirms)
        const testDoc = documents[0];
        console.log(`\n3. Testing deletion of: "${testDoc.filename}" (ID: ${testDoc.id})`);
        console.log('⚠️  This will actually delete the document!');
        
        // Check if document has chunks first
        try {
            console.log('🔍 Checking document chunks...');
            const chunksResponse = await axios.get(`${DOCUMENT_SERVICE_URL.replace('3001', '3005')}/api/documentchunk?document_id=${testDoc.id}`);
            const chunks = chunksResponse.data.data || [];
            console.log(`📊 Document has ${chunks.length} chunks to delete`);
        } catch (chunkError) {
            console.log('⚠️  Could not check chunks (database service might be down)');
        }
        
        console.log('🔄 Starting deletion request...');
        const deleteResponse = await axios.delete(
            `${DOCUMENT_SERVICE_URL}/documents/${testDoc.id}?session_id=test_${Date.now()}`,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        console.log('✅ Delete request successful!');
        console.log('Response:', deleteResponse.data);
        
        // Verify deletion
        console.log('\n4. Verifying deletion...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const updatedDocuments = await axios.get(`${DOCUMENT_SERVICE_URL}/documents`);
        const remainingDocs = updatedDocuments.data.documents || [];
        
        const wasDeleted = !remainingDocs.find(doc => doc.id === testDoc.id);
        
        if (wasDeleted) {
            console.log('✅ Document successfully deleted!');
            console.log(`📊 Documents remaining: ${remainingDocs.length}`);
        } else {
            console.log('❌ Document still exists - deletion may have failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the document service is running:');
            console.log('   node start-all-services.js');
        }
    }
}

// Add a safer test mode that doesn't actually delete
async function testDocumentDeletionSafe() {
    console.log('🧪 Testing Document Deletion (Safe Mode)...\n');
    
    try {
        // Test with an invalid document ID to check error handling
        console.log('1. Testing error handling with invalid ID...');
        try {
            await axios.delete(`${DOCUMENT_SERVICE_URL}/documents/invalid-id`);
            console.log('❌ Should have returned an error');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('✅ Correctly returned 404 for invalid document');
            } else {
                console.log('✅ Returned error as expected:', error.response?.status || error.message);
            }
        }
        
        // Test the documents listing endpoint
        console.log('\n2. Testing document listing...');
        const response = await axios.get(`${DOCUMENT_SERVICE_URL}/documents`);
        console.log('✅ Document listing works');
        console.log(`📄 Found ${response.data.documents?.length || 0} documents`);
        
    } catch (error) {
        console.error('❌ Safe test failed:', error.message);
    }
}

// Run safe test by default, actual test if --real flag is provided
const args = process.argv.slice(2);
if (args.includes('--real')) {
    testDocumentDeletion();
} else {
    testDocumentDeletionSafe();
    console.log('\n💡 Use --real flag to test actual deletion (be careful!)');
}