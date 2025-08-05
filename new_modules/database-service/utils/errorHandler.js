// Standardized error response utility
export class ErrorHandler {
    static createError(message, statusCode = 500, details = null, errorCode = null) {
        return {
            error: {
                message,
                statusCode,
                details,
                errorCode,
                timestamp: new Date().toISOString(),
                service: 'database-service'
            }
        };
    }

    static handleDatabaseError(error, operation = 'database operation') {
        console.error(`Database error during ${operation}:`, error);
        
        // PostgreSQL specific error codes
        if (error.code === '23505') {
            return this.createError('Resource already exists', 409, error.detail, 'DUPLICATE_ENTRY');
        }
        if (error.code === '23503') {
            return this.createError('Foreign key constraint violation', 400, error.detail, 'FOREIGN_KEY_VIOLATION');
        }
        if (error.code === '23502') {
            return this.createError('Required field missing', 400, error.detail, 'NOT_NULL_VIOLATION');
        }
        if (error.code === '42P01') {
            return this.createError('Table does not exist', 500, error.detail, 'TABLE_NOT_FOUND');
        }
        
        return this.createError(`Database operation failed: ${operation}`, 500, error.message, 'DATABASE_ERROR');
    }

    static handleValidationError(message, details = null) {
        return this.createError(message, 400, details, 'VALIDATION_ERROR');
    }

    static handleNotFoundError(resource = 'Resource') {
        return this.createError(`${resource} not found`, 404, null, 'NOT_FOUND');
    }

    static handleServiceUnavailableError(service = 'External service') {
        return this.createError(`${service} is currently unavailable`, 503, null, 'SERVICE_UNAVAILABLE');
    }
}

// Express middleware for handling errors
export function errorMiddleware(error, req, res, next) {
    console.error('Unhandled error:', error);
    
    // If it's already a standardized error, send it
    if (error.error && error.error.statusCode) {
        return res.status(error.error.statusCode).json(error);
    }
    
    // Otherwise, create a standardized error
    const standardError = ErrorHandler.createError(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? error.message : null,
        'INTERNAL_ERROR'
    );
    
    res.status(500).json(standardError);
}