const { ValidationError } = require('../utils/errors');

class AccountService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get account information
   * @returns {Promise<Object>} Account details
   */
  async getAccount() {
    return await this.client.get('/account');
  }

  /**
   * Get account balance
   * @returns {Promise<Object>} Balance information
   */
  async getBalance() {
    return await this.client.get('/account/balance');
  }

  /**
   * Get billing history
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.startDate - Start date filter
   * @param {string} options.endDate - End date filter
   * @returns {Promise<Object>} Billing history
   */
  async getBillingHistory(options = {}) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate
    } = options;

    const params = { page, limit };
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return await this.client.get('/account/billing', params);
  }

  /**
   * Get transaction history
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.type - Transaction type filter
   * @param {string} options.status - Transaction status filter
   * @returns {Promise<Object>} Transaction history
   */
  async getTransactionHistory(options = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      status
    } = options;

    const params = { page, limit };
    
    if (type) params.type = type;
    if (status) params.status = status;

    return await this.client.get('/account/transactions', params);
  }

  /**
   * Update account settings
   * @param {Object} settings - Account settings to update
   * @param {string} settings.companyName - Company name
   * @param {string} settings.contactEmail - Contact email
   * @param {Object} settings.billingAddress - Billing address
   * @param {Object} settings.notifications - Notification preferences
   * @returns {Promise<Object>} Updated account settings
   */
  async updateAccountSettings(settings) {
    if (!settings || Object.keys(settings).length === 0) {
      throw new ValidationError('Settings data is required');
    }

    return await this.client.put('/account/settings', settings);
  }

  /**
   * Get API usage statistics
   * @param {Object} options - Query options
   * @param {string} options.period - Time period ('day', 'week', 'month')
   * @param {number} options.limit - Number of periods to return
   * @returns {Promise<Object>} API usage stats
   */
  async getAPIUsage(options = {}) {
    const {
      period = 'day',
      limit = 30
    } = options;

    const params = { period, limit };

    return await this.client.get('/account/api-usage', params);
  }

  /**
   * Get account notifications
   * @param {Object} options - Query options
   * @param {boolean} options.unreadOnly - Get only unread notifications
   * @param {number} options.limit - Number of notifications to return
   * @returns {Promise<Object>} Account notifications
   */
  async getNotifications(options = {}) {
    const {
      unreadOnly = false,
      limit = 50
    } = options;

    const params = { limit };
    
    if (unreadOnly) params.status = 'unread';

    return await this.client.get('/account/notifications', params);
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Update result
   */
  async markNotificationAsRead(notificationId) {
    if (!notificationId) {
      throw new ValidationError('Notification ID is required');
    }

    return await this.client.put(`/account/notifications/${notificationId}`, {
      status: 'read'
    });
  }

  /**
   * Get account limits and quotas
   * @returns {Promise<Object>} Account limits
   */
  async getAccountLimits() {
    return await this.client.get('/account/limits');
  }

  /**
   * Request account credit/top-up
   * @param {Object} creditRequest - Credit request details
   * @param {number} creditRequest.amount - Amount to credit
   * @param {string} creditRequest.currency - Currency code
   * @param {string} creditRequest.paymentMethod - Payment method
   * @param {string} creditRequest.reference - Reference/invoice number
   * @returns {Promise<Object>} Credit request result
   */
  async requestCredit(creditRequest) {
    if (!creditRequest || !creditRequest.amount || !creditRequest.currency) {
      throw new ValidationError('Amount and currency are required');
    }

    if (creditRequest.amount <= 0) {
      throw new ValidationError('Credit amount must be positive');
    }

    return await this.client.post('/account/credit', creditRequest);
  }

  /**
   * Generate API key
   * @param {Object} keyOptions - API key options
   * @param {string} keyOptions.name - Key name/description
   * @param {Array<string>} keyOptions.permissions - Key permissions
   * @param {string} keyOptions.expiresAt - Expiration date (optional)
   * @returns {Promise<Object>} New API key details
   */
  async generateAPIKey(keyOptions) {
    if (!keyOptions || !keyOptions.name) {
      throw new ValidationError('API key name is required');
    }

    return await this.client.post('/account/api-keys', keyOptions);
  }

  /**
   * Revoke API key
   * @param {string} keyId - API key ID to revoke
   * @returns {Promise<Object>} Revocation result
   */
  async revokeAPIKey(keyId) {
    if (!keyId) {
      throw new ValidationError('API key ID is required');
    }

    return await this.client.delete(`/account/api-keys/${keyId}`);
  }

  /**
   * List API keys
   * @returns {Promise<Object>} List of API keys
   */
  async listAPIKeys() {
    return await this.client.get('/account/api-keys');
  }
}

module.exports = AccountService;