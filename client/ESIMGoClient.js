const axios = require('axios');
const { APIError, ValidationError, AuthenticationError } = require('../utils/errors');

class ESIMGoClient {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new ValidationError('API key is required');
    }

    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://api.esim-go.com/v2.5';
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ESIMGo-NodeJS-Wrapper/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        console.log(`Making ${config.method.toUpperCase()} request to ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401) {
          throw new AuthenticationError('Invalid API key or unauthorized access');
        }
        
        if (error.response?.status === 429) {
          throw new APIError('Rate limit exceeded', 429);
        }
        
        // Retry logic for certain status codes
        if (
          error.response?.status >= 500 &&
          originalRequest._retryCount < this.maxRetries
        ) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          const delay = Math.pow(2, originalRequest._retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.httpClient(originalRequest);
        }

        throw this.handleError(error);
      }
    );
  }

  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.error || `HTTP ${status} Error`;
      return new APIError(message, status, data);
    }
    
    if (error.request) {
      return new APIError('Network error - no response received', 0);
    }
    
    return new APIError(error.message || 'Unknown error occurred');
  }

  async makeRequest(method, endpoint, data = null, params = null, headers = {}) {
    try {
      const config = {
        method,
        url: endpoint,
        headers: { ...headers },
        ...(params && { params }),
        ...(data && { data })
      };

      const response = await this.httpClient(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Generic GET request
  async get(endpoint, params = null, headers = {}) {
    return this.makeRequest('GET', endpoint, null, params, headers);
  }

  // Generic POST request
  async post(endpoint, data = null, headers = {}) {
    return this.makeRequest('POST', endpoint, data, null, headers);
  }

  // Generic PUT request
  async put(endpoint, data = null, headers = {}) {
    return this.makeRequest('PUT', endpoint, data, null, headers);
  }

  // Generic DELETE request
  async delete(endpoint, headers = {}) {
    return this.makeRequest('DELETE', endpoint, null, null, headers);
  }

  // Health check
  async healthCheck() {
    try {
      await this.get('/');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

module.exports = ESIMGoClient;