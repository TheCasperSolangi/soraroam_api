const { ValidationError } = require('../utils/errors');
const { validatePaginationParams, validateDateRange } = require('../utils/validators');

class OrdersService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get list of orders with optional filters and pagination
   * @param {Object} options - Query options
   * @param {boolean} options.includeEsimData - Include eSIM data in response
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10)
   * @param {string} options.createdAtGte - Filter orders created after this date
   * @param {string} options.createdAtLte - Filter orders created before this date
   * @returns {Promise<Object>} Orders list with pagination info
   */
  async getOrders(options = {}) {
    const {
      includeEsimData = false,
      page = 1,
      limit = 10,
      createdAtGte,
      createdAtLte
    } = options;

    // Validate pagination parameters
    validatePaginationParams(page, limit);

    // Build query parameters
    const params = {
      includeEsimData,
      page,
      limit
    };

    // Add date filters if provided
    if (createdAtGte) {
      if (!validateDateRange(createdAtGte)) {
        throw new ValidationError('Invalid createdAtGte date format');
      }
      params['createdAt'] = `gte:${createdAtGte}`;
    }

    if (createdAtLte) {
      if (!validateDateRange(createdAtLte)) {
        throw new ValidationError('Invalid createdAtLte date format');
      }
      // If we already have gte filter, we need to handle multiple createdAt params
      if (params['createdAt']) {
        // This would need special handling in the actual request
        params['createdAtLte'] = `lte:${createdAtLte}`;
      } else {
        params['createdAt'] = `lte:${createdAtLte}`;
      }
    }

    return await this.client.get('/orders', params);
  }

  /**
   * Get specific order by reference
   * @param {string} orderReference - Order reference ID
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderReference) {
    if (!orderReference) {
      throw new ValidationError('Order reference is required');
    }

    return await this.client.get(`/orders/${orderReference}`);
  }

  /**
   * Create a new order for eSIM bundles
   * @param {Object} orderData - Order details
   * @param {Array} orderData.items - Array of bundle items
   * @param {string} orderData.items[].bundleId - Bundle identifier
   * @param {number} orderData.items[].quantity - Quantity of bundles
   * @param {boolean} orderData.allowReassign - Allow reassign if eSIM not compatible
   * @param {string} orderData.customerReference - Optional customer reference
   * @returns {Promise<Object>} Created order details
   */
  async createOrder(orderData) {
    if (!orderData || !orderData.items || !Array.isArray(orderData.items)) {
      throw new ValidationError('Order items are required and must be an array');
    }

    if (orderData.items.length === 0) {
      throw new ValidationError('At least one order item is required');
    }

    // Validate each item
    orderData.items.forEach((item, index) => {
      if (!item.bundleId) {
        throw new ValidationError(`Bundle ID is required for item ${index + 1}`);
      }
      if (!item.quantity || item.quantity < 1) {
        throw new ValidationError(`Valid quantity is required for item ${index + 1}`);
      }
    });

    return await this.client.post('/orders', orderData);
  }

  /**
   * Cancel an order
   * @param {string} orderReference - Order reference to cancel
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelOrder(orderReference, reason = 'User requested cancellation') {
    if (!orderReference) {
      throw new ValidationError('Order reference is required');
    }

    return await this.client.delete(`/orders/${orderReference}`, {
      reason
    });
  }

  /**
   * Get order statistics for a date range
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @returns {Promise<Object>} Order statistics
   */
  async getOrderStats(startDate, endDate) {
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    if (!validateDateRange(startDate) || !validateDateRange(endDate)) {
      throw new ValidationError('Invalid date format');
    }

    const params = {
      createdAtGte: startDate,
      createdAtLte: endDate,
      includeEsimData: true,
      limit: 1000 // Get more data for statistics
    };

    const response = await this.client.get('/orders', params);
    
    // Calculate statistics
    const stats = {
      totalOrders: response.orders?.length || 0,
      totalAmount: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      currency: 'USD'
    };

    if (response.orders) {
      response.orders.forEach(order => {
        stats.totalAmount += order.total || 0;
        
        switch (order.status?.toLowerCase()) {
          case 'completed':
            stats.completedOrders++;
            break;
          case 'cancelled':
            stats.cancelledOrders++;
            break;
          case 'pending':
            stats.pendingOrders++;
            break;
        }
        
        if (order.currency && !stats.currency) {
          stats.currency = order.currency;
        }
      });
    }

    return stats;
  }
}

module.exports = OrdersService;