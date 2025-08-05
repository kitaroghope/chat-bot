#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Services that need npm install
const services = [
    'database-service',
    'document-service', 
    'ai-service',
    'whatsapp-service',
    'web-interface',
    'api-gateway'
];

// Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = '') {
    console.log(`${color}${message}${colors.reset}`);
}

function runNpmInstall(servicePath) {
    return new Promise((resolve, reject) => {
        const serviceName = path.basename(servicePath);
        log(`Installing dependencies for ${serviceName}...`, colors.cyan);

        const child = spawn('npm', ['install'], {
            cwd: servicePath,
            stdio: 'pipe',
            shell: true
        });

        let output = '';
        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('error', (error) => {
            log(`❌ Failed to install ${serviceName}: ${error.message}`, colors.red);
            reject(error);
        });

        child.on('exit', (code) => {
            if (code === 0) {
                log(`✅ Successfully installed dependencies for ${serviceName}`, colors.green);
                resolve();
            } else {
                log(`❌ Failed to install ${serviceName} (exit code: ${code})`, colors.red);
                console.log(output);
                reject(new Error(`npm install failed for ${serviceName}`));
            }
        });
    });
}

async function installAllDependencies() {
    log('🚀 Installing dependencies for all microservices...', colors.bright);
    console.log('');

    let successful = 0;
    let failed = 0;

    for (const service of services) {
        const servicePath = path.join(__dirname, service);
        
        // Check if service directory exists
        if (!fs.existsSync(servicePath)) {
            log(`⚠️  Service directory not found: ${service}`, colors.yellow);
            continue;
        }

        // Check if package.json exists
        const packagePath = path.join(servicePath, 'package.json');
        if (!fs.existsSync(packagePath)) {
            log(`⚠️  No package.json found in ${service}`, colors.yellow);
            continue;
        }

        try {
            await runNpmInstall(servicePath);
            successful++;
        } catch (error) {
            failed++;
        }
        
        console.log(''); // Add spacing between services
    }

    console.log('');
    log('📊 Installation Summary:', colors.bright);
    log(`✅ Successful: ${successful}`, colors.green);
    log(`❌ Failed: ${failed}`, failed > 0 ? colors.red : colors.green);

    if (failed === 0) {
        console.log('');
        log('🎉 All dependencies installed successfully!', colors.green);
        log('You can now start the services using:', colors.bright);
        log('  node start-all-services.js', colors.cyan);
    } else {
        console.log('');
        log('⚠️  Some installations failed. Please check the error messages above.', colors.yellow);
    }
}

// Run the installation
installAllDependencies().catch((error) => {
    log(`❌ Installation process failed: ${error.message}`, colors.red);
    process.exit(1);
});