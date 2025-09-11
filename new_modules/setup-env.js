import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const services = [
    {
        name: 'api-gateway',
        port: 3000,
        envVars: {
            'DOCUMENT_SERVICE_URL': 'https://chat-bot-01.onrender.com',
            'AI_SERVICE_URL': 'https://chat-bot-02-pony.onrender.com',
            'WHATSAPP_SERVICE_URL': 'https://chat-bot-03.onrender.com',
            'WEB_SERVICE_URL': 'https://chat-bot-04.onrender.com',
            'DATABASE_SERVICE_URL': 'https://chat-bot-05.onrender.com'
        }
    },
    {
        name: 'document-service',
        port: 3001,
        envVars: {
            'DATABASE_SERVICE_URL': 'https://chat-bot-05.onrender.com'
        }
    },
    {
        name: 'ai-service',
        port: 3002,
        envVars: {
            'DATABASE_SERVICE_URL': 'https://chat-bot-05.onrender.com',
            'GROQ_API_KEY': 'your_groq_api_key_here',
            'GOOGLE_API_KEY': 'your_google_gemini_api_key_here'
        }
    },
    {
        name: 'whatsapp-service',
        port: 3003,
        envVars: {
            'DATABASE_SERVICE_URL': 'https://chat-bot-05.onrender.com',
            'WHATSAPP_ACCESS_TOKEN': 'your_whatsapp_business_token_here',
            'WHATSAPP_VERIFY_TOKEN': 'your_webhook_verify_token_here',
            'WHATSAPP_APP_SECRET': 'your_whatsapp_app_secret_here',
            'WHATSAPP_PHONE_NUMBER_ID': 'your_phone_number_id_here',
            'AI_SERVICE_URL': 'https://chat-bot-02-pony.onrender.com',
            'DOCUMENT_SERVICE_URL': 'https://chat-bot-01.onrender.com'
        }
    },
    {
        name: 'web-interface',
        port: 3004,
        envVars: {
            'DATABASE_SERVICE_URL': 'https://chat-bot-05.onrender.com',
            'API_GATEWAY_URL': 'https://chat-bot-00.onrender.com',
            'ALLOWED_ORIGINS': 'https://chat-bot-04.onrender.com,https://chat-bot-00.onrender.com'
        }
    },
    {
        name: 'database-service',
        port: 3005,
        envVars: {
            'DATABASE_URL': 'your_neon_postgresql_connection_string_here',
            'JWT_SECRET': 'your_jwt_secret_here',
            'BCRYPT_ROUNDS': '12'
        }
    }
];

function createEnvFile(service) {
    const envContent = [
        `# ${service.name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Configuration`,
        `PORT=${service.port}`,
        `NODE_ENV=development`,
        '',
        ...Object.entries(service.envVars).map(([key, value]) => `${key}=${value}`)
    ].join('\n');

    const envPath = path.join(__dirname, service.name, '.env.example');
    
    try {
        fs.writeFileSync(envPath, envContent);
        console.log(`✅ Created ${service.name}/.env.example`);
    } catch (error) {
        console.error(`❌ Failed to create ${service.name}/.env.example:`, error.message);
    }
}

function copyDatabaseClient(serviceName) {
    const sourcePath = path.join(__dirname, 'database-service', 'client', 'DatabaseClient.js');
    const targetDir = path.join(__dirname, serviceName, 'utils');
    const targetPath = path.join(targetDir, 'DatabaseClient.js');

    try {
        // Create utils directory if it doesn't exist
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Copy the DatabaseClient.js file
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied DatabaseClient to ${serviceName}/utils/`);
    } catch (error) {
        console.error(`❌ Failed to copy DatabaseClient to ${serviceName}:`, error.message);
    }
}

console.log('🚀 Setting up environment files and database clients...\n');

services.forEach(service => {
    createEnvFile(service);
    
    // Copy DatabaseClient to services that need it (all except database-service itself)
    if (service.name !== 'database-service') {
        copyDatabaseClient(service.name);
    }
});

console.log('\n🎉 Setup complete! Next steps:');
console.log('1. Copy each .env.example to .env and fill in your actual values');
console.log('2. Set up your Neon PostgreSQL database and add the connection string');
console.log('3. Run "npm run migrate" in database-service to create the schema');
console.log('4. Start all services in order: database-service, then others');