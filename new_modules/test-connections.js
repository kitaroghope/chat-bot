#!/usr/bin/env node

import axios from 'axios';

// Test service endpoints
const services = [
    { name: 'Database Service', url: 'http://localhost:3005', path: '/health' },
    { name: 'Document Service', url: 'http://localhost:3001', path: '/health' },
    { name: 'AI Service', url: 'http://localhost:3002', path: '/health' },
    { name: 'WhatsApp Service', url: 'http://localhost:3003', path: '/health' },
    { name: 'Web Interface', url: 'http://localhost:3004', path: '/health' },
    { name: 'API Gateway', url: 'http://localhost:3000', path: '/health' },
];

const testEndpoints = [
    { name: 'Document List', url: 'http://localhost:3001', path: '/documents' },
    { name: 'API Gateway Config', url: 'http://localhost:3000', path: '/api/config' },
    { name: 'Web Interface Config', url: 'http://localhost:3004', path: '/api/config' },
];

async function testService(service) {
    try {
        console.log(`Testing ${service.name}...`);
        const response = await axios.get(`${service.url}${service.path}`, {
            timeout: 5000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Connection-Tester/1.0'
            }
        });
        
        console.log(`✅ ${service.name}: OK (${response.status}) - ${response.data.status || 'Available'}`);
        return { service: service.name, status: 'success', details: response.data };
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log(`❌ ${service.name}: Service not running`);
            return { service: service.name, status: 'not_running', error: 'Connection refused' };
        } else if (error.code === 'ETIMEDOUT') {
            console.log(`⏰ ${service.name}: Timeout`);
            return { service: service.name, status: 'timeout', error: 'Request timeout' };
        } else {
            console.log(`❌ ${service.name}: Error - ${error.message}`);
            return { service: service.name, status: 'error', error: error.message };
        }
    }
}

async function runTests() {
    console.log('🧪 Testing Chat Bot Service Connections...\n');
    
    // Test health endpoints
    console.log('=== Health Check Tests ===');
    const healthResults = [];
    for (const service of services) {
        const result = await testService(service);
        healthResults.push(result);
    }
    
    console.log('\n=== API Endpoint Tests ===');
    const endpointResults = [];
    for (const endpoint of testEndpoints) {
        const result = await testService(endpoint);
        endpointResults.push(result);
    }
    
    // Summary
    console.log('\n=== Test Summary ===');
    const successCount = [...healthResults, ...endpointResults].filter(r => r.status === 'success').length;
    const totalCount = healthResults.length + endpointResults.length;
    
    console.log(`✅ ${successCount}/${totalCount} services responding`);
    
    const failedServices = [...healthResults, ...endpointResults].filter(r => r.status !== 'success');
    if (failedServices.length > 0) {
        console.log('\n🔧 Issues found:');
        failedServices.forEach(service => {
            console.log(`   - ${service.service}: ${service.error}`);
        });
        
        console.log('\n💡 To fix:');
        console.log('   1. Run: node start-all-services.js');
        console.log('   2. Wait for all services to start');
        console.log('   3. Re-run this test');
    } else {
        console.log('\n🎉 All services are working correctly!');
        console.log('\n🌐 Access URLs:');
        console.log('   - Main App: http://localhost:3000');
        console.log('   - Web Chat: http://localhost:3004');
        console.log('   - Document Service: http://localhost:3001');
    }
}

runTests().catch(console.error);