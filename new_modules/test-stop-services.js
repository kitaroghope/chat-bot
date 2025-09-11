#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test ports that our services use
const testPorts = [3000, 3001, 3002, 3003, 3004, 3005];

async function checkPortStatus(port) {
    try {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            return stdout.trim().length > 0;
        } else {
            const { stdout } = await execAsync(`lsof -ti :${port}`);
            return stdout.trim().length > 0;
        }
    } catch (error) {
        return false;
    }
}

async function testStopScript() {
    console.log('🧪 Testing Stop Services Script...\n');
    
    // Check initial state
    console.log('1. Checking current service status...');
    const initialStatus = {};
    
    for (const port of testPorts) {
        const isRunning = await checkPortStatus(port);
        initialStatus[port] = isRunning;
        console.log(`   Port ${port}: ${isRunning ? '✅ In use' : '❌ Free'}`);
    }
    
    const runningCount = Object.values(initialStatus).filter(Boolean).length;
    
    if (runningCount === 0) {
        console.log('\n🤷 No services are currently running');
        console.log('💡 Start services first with: node start-all-services.js');
        console.log('   Then test stopping them with: node stop-all-services.js');
        return;
    }
    
    console.log(`\n📊 Found ${runningCount} services running`);
    
    // Test the help command
    console.log('\n2. Testing help command...');
    try {
        const { stdout } = await execAsync('node stop-all-services.js --help');
        console.log('✅ Help command works');
        console.log('   Help output length:', stdout.length, 'characters');
    } catch (error) {
        console.log('❌ Help command failed:', error.message);
    }
    
    // Test dry run (checking processes without stopping)
    console.log('\n3. Script is ready to use!');
    console.log('   🛑 To stop services: node stop-all-services.js');
    console.log('   ⚡ For force stop: node stop-all-services.js --force');
    console.log('   📖 For help: node stop-all-services.js --help');
    
    console.log('\n💡 Batch/Shell files are also available:');
    console.log('   Windows: stop-all-services.bat');
    console.log('   Unix/Linux/Mac: ./stop-all-services.sh');
    
    console.log('\n⚠️  This test didn\'t actually stop services');
    console.log('   Run the actual stop script when you\'re ready');
}

testStopScript().catch(console.error);