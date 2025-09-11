#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import process from 'process';

const execAsync = promisify(exec);

// Service configurations (matching start-all-services.js)
const services = [
    { name: 'API Gateway', port: 3000 },
    { name: 'Document Service', port: 3001 },
    { name: 'AI Service', port: 3002 },
    { name: 'WhatsApp Service', port: 3003 },
    { name: 'Web Interface', port: 3004 },
    { name: 'Database Service', port: 3005 }
];

// Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

function log(message, color = '') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Get process ID running on a specific port
async function getProcessOnPort(port) {
    try {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            // Windows: use netstat to find process
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            const lines = stdout.trim().split('\n');
            
            for (const line of lines) {
                if (line.includes('LISTENING')) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) {
                        return parseInt(pid);
                    }
                }
            }
        } else {
            // Unix/Linux/Mac: use lsof
            const { stdout } = await execAsync(`lsof -ti :${port}`);
            const pid = stdout.trim();
            if (pid && !isNaN(pid)) {
                return parseInt(pid);
            }
        }
    } catch (error) {
        // No process found on port or command failed
        return null;
    }
    return null;
}

// Get process info by PID
async function getProcessInfo(pid) {
    try {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
            const line = stdout.trim().split('\n')[0];
            if (line && line !== 'INFO: No tasks are running which match the specified criteria.') {
                const parts = line.split('","');
                const processName = parts[0].replace('"', '');
                return { name: processName, pid };
            }
        } else {
            const { stdout } = await execAsync(`ps -p ${pid} -o comm=`);
            const processName = stdout.trim();
            if (processName) {
                return { name: processName, pid };
            }
        }
    } catch (error) {
        // Process might have already died
    }
    return null;
}

// Kill process by PID
async function killProcess(pid, force = false) {
    try {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            const signal = force ? '/F' : '';
            await execAsync(`taskkill /PID ${pid} ${signal}`);
        } else {
            const signal = force ? '-9' : '-15';
            await execAsync(`kill ${signal} ${pid}`);
        }
        return true;
    } catch (error) {
        return false;
    }
}

// Kill all Node.js processes running our services (emergency cleanup)
async function emergencyCleanup() {
    try {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            log('🚨 Emergency cleanup: Killing all Node.js processes...', colors.red);
            await execAsync('taskkill /F /IM node.exe');
        } else {
            log('🚨 Emergency cleanup: Killing Node.js processes on service ports...', colors.red);
            for (const service of services) {
                try {
                    await execAsync(`lsof -ti :${service.port} | xargs kill -9`);
                } catch (e) {
                    // Ignore errors - port might not be in use
                }
            }
        }
        log('✅ Emergency cleanup completed', colors.green);
    } catch (error) {
        log('❌ Emergency cleanup failed: ' + error.message, colors.red);
    }
}

async function stopService(service) {
    log(`Stopping ${service.name} (port ${service.port})...`, colors.yellow);
    
    const pid = await getProcessOnPort(service.port);
    
    if (!pid) {
        log(`  ℹ️  ${service.name}: Not running`, colors.dim);
        return { service: service.name, status: 'not_running' };
    }
    
    const processInfo = await getProcessInfo(pid);
    if (processInfo) {
        log(`  📋 Found process: ${processInfo.name} (PID: ${pid})`, colors.blue);
    }
    
    // Try graceful shutdown first
    log(`  🛑 Sending SIGTERM to PID ${pid}...`, colors.cyan);
    const gracefulStop = await killProcess(pid, false);
    
    if (gracefulStop) {
        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if process is still running
        const stillRunning = await getProcessOnPort(service.port);
        
        if (!stillRunning) {
            log(`  ✅ ${service.name}: Stopped gracefully`, colors.green);
            return { service: service.name, status: 'stopped_gracefully' };
        }
    }
    
    // Force kill if graceful shutdown failed
    log(`  ⚡ Force killing PID ${pid}...`, colors.red);
    const forceStop = await killProcess(pid, true);
    
    if (forceStop) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const stillRunning = await getProcessOnPort(service.port);
        
        if (!stillRunning) {
            log(`  ✅ ${service.name}: Force stopped`, colors.green);
            return { service: service.name, status: 'force_stopped' };
        } else {
            log(`  ❌ ${service.name}: Failed to stop`, colors.red);
            return { service: service.name, status: 'failed' };
        }
    } else {
        log(`  ❌ ${service.name}: Kill command failed`, colors.red);
        return { service: service.name, status: 'kill_failed' };
    }
}

async function stopAllServices() {
    console.log(`${colors.bright}🛑 Stopping Chat Bot Services...${colors.reset}\n`);
    
    const results = [];
    
    // Stop services in reverse order (opposite of start order)
    const reversedServices = [...services].reverse();
    
    for (const service of reversedServices) {
        const result = await stopService(service);
        results.push(result);
    }
    
    // Summary
    console.log(`\n${colors.bright}📊 Stop Summary:${colors.reset}`);
    
    const stopped = results.filter(r => r.status.includes('stopped')).length;
    const notRunning = results.filter(r => r.status === 'not_running').length;
    const failed = results.filter(r => r.status.includes('failed')).length;
    
    console.log(`${colors.green}✅ Stopped: ${stopped}${colors.reset}`);
    console.log(`${colors.dim}ℹ️  Not running: ${notRunning}${colors.reset}`);
    
    if (failed > 0) {
        console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
        console.log(`\n${colors.yellow}💡 Failed services:${colors.reset}`);
        results.filter(r => r.status.includes('failed')).forEach(r => {
            console.log(`   - ${r.service}: ${r.status}`);
        });
        
        console.log(`\n${colors.red}🚨 Use --force for emergency cleanup${colors.reset}`);
    } else {
        console.log(`\n${colors.bright}🎉 All services stopped successfully!${colors.reset}`);
    }
    
    // Clean up any leftover temp files
    console.log(`\n${colors.dim}🧹 Cleaning up temporary files...${colors.reset}`);
    try {
        await execAsync('rm -rf */uploads/* 2>/dev/null || del /Q /S *\\uploads\\* 2>nul || echo "No temp files to clean"');
        console.log(`${colors.green}✅ Cleanup completed${colors.reset}`);
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Cleanup warning: ${error.message}${colors.reset}`);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`${colors.bright}📖 Stop All Services Help${colors.reset}

Usage: node stop-all-services.js [options]

Options:
  --force, -f    Emergency cleanup (force kill all Node.js processes)
  --help, -h     Show this help message

Examples:
  node stop-all-services.js          # Normal shutdown
  node stop-all-services.js --force  # Emergency cleanup
`);
    process.exit(0);
}

if (args.includes('--force') || args.includes('-f')) {
    emergencyCleanup().then(() => process.exit(0));
} else {
    stopAllServices().then(() => process.exit(0));
}

// Handle Ctrl+C during script execution
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}⚠️  Script interrupted. Some services might still be running.${colors.reset}`);
    console.log(`${colors.dim}💡 Use --force flag for emergency cleanup${colors.reset}`);
    process.exit(1);
});