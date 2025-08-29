import axios from 'axios';

// Simple Circuit Breaker implementation
export class CircuitBreaker {
    constructor(options = {}) {
        this.timeout = options.timeout || 5000;
        this.resetTimeout = options.resetTimeout || 30000;
        this.threshold = options.threshold || 5;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }

    async call(serviceCall) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            } else {
                throw new Error('Circuit breaker is OPEN - service unavailable');
            }
        }

        try {
            const result = await this.executeWithTimeout(serviceCall);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    async executeWithTimeout(serviceCall) {
        return Promise.race([
            serviceCall(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), this.timeout)
            )
        ]);
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 3) {
                this.state = 'CLOSED';
            }
        }
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime
        };
    }
}

// Service-specific circuit breakers
export class ServiceBreakers {
    constructor() {
        this.breakers = new Map();
    }

    getBreaker(serviceName) {
        if (!this.breakers.has(serviceName)) {
            this.breakers.set(serviceName, new CircuitBreaker({
                timeout: 15000,  // Increased to 15s for slow AI responses
                resetTimeout: 60000,  // Reset after 1 minute instead of 30s
                threshold: 8  // Allow more failures before opening
            }));
        }
        return this.breakers.get(serviceName);
    }

    async callService(serviceName, serviceCall) {
        const breaker = this.getBreaker(serviceName);
        return breaker.call(serviceCall);
    }

    getStatus() {
        const status = {};
        for (const [serviceName, breaker] of this.breakers) {
            status[serviceName] = breaker.getState();
        }
        return status;
    }
}

// HTTP client with circuit breaker
export async function resilientHttpCall(url, options = {}, serviceName = 'default') {
    const breakers = global.serviceBreakers || (global.serviceBreakers = new ServiceBreakers());
    
    return breakers.callService(serviceName, async () => {
        const config = {
            timeout: 15000,
            ...options
        };
        
        const response = await axios(url, config);
        return response;
    });
}