class ESIMGoError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

class APIError extends ESIMGoError {
  constructor(message, statusCode = 500, apiResponse = null) {
    super(message, statusCode, apiResponse);
  }
}

class AuthenticationError extends ESIMGoError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends ESIMGoError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

class ValidationError extends ESIMGoError {
  constructor(message, field = null) {
    super(message, 400, { field });
  }
}

class NotFoundError extends ESIMGoError {
  constructor(message = 'Resource not found', resource = null) {
    super(message, 404, { resource });
  }
}

class RateLimitError extends ESIMGoError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 429, { retryAfter });
  }
}

class ServiceUnavailableError extends ESIMGoError {
  constructor(message = 'Service temporarily unavailable', retryAfter = null) {
    super(message, 503, { retryAfter });
  }
}

class NetworkError extends ESIMGoError {
  constructor(message = 'Network connection failed') {
    super(message, 0);
  }
}

class TimeoutError extends ESIMGoError {
  constructor(message = 'Request timeout') {
    super(message, 408);
  }
}

class InternalServerError extends ESIMGoError {
  constructor(message = 'Internal server error') {
    super(message, 500);
  }
}

// Error factory function
function createError(error) {
  if (error instanceof ESIMGoError) {
    return error;
  }

  if (error.response) {
    const { status, data } = error.response;
    const message = data?.message || data?.error || `HTTP ${status} Error`;

    switch (status) {
      case 400:
        return new ValidationError(message);
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthorizationError(message);
      case 404:
        return new NotFoundError(message);
      case 408:
        return new TimeoutError(message);
      case 429:
        return new RateLimitError(message, data?.retryAfter);
      case 503:
        return new ServiceUnavailableError(message, data?.retryAfter);
      default:
        return new APIError(message, status, data);
    }
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new TimeoutError('Request timeout');
  }

  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new NetworkError('Network connection failed');
  }

  return new ESIMGoError(error.message || 'Unknown error occurred');
}

// Error handler middleware for Express
function errorHandler(err, req, res, next) {
  const error = createError(err);
  
  // Log error details
  console.error('ESIMGo API Error:', {
    url: req.originalUrl,
    method: req.method,
    error: error.toJSON(),
    stack: error.stack
  });

  res.status(error.statusCode).json(error.toJSON());
}

module.exports = {
  ESIMGoError,
  APIError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  NetworkError,
  TimeoutError,
  InternalServerError,
  createError,
  errorHandler
};