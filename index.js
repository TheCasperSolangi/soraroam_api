const ESIMGoClient = require('./client/ESIMGoClient');
const OrdersService = require('./services/OrdersService');
const ESIMsService = require('./services/ESIMsService');
const BundlesService = require('./services/BundlesService');
const AccountService = require('./services/AccountService');

class ESIMGo {
  constructor(apiKey, options = {}) {
    // Initialize the HTTP client
    this.client = new ESIMGoClient(apiKey, options);

    // Initialize all service modules
    this.orders = new OrdersService(this.client);
    this.esims = new ESIMsService(this.client);
    this.bundles = new BundlesService(this.client);
    this.account = new AccountService(this.client);

    // Expose client for advanced usage
    this.httpClient = this.client;
  }

  /**
   * Test API connectivity and authentication
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    return await this.client.healthCheck();
  }

  /**
   * Get API version info
   * @returns {Object} Version information
   */
  getVersion() {
    return {
      version: '1.0.0',
      apiVersion: 'v2.5',
      client: 'ESIMGo-NodeJS-Wrapper'
    };
  }

  /**
   * Update API key (useful for key rotation)
   * @param {string} newApiKey - New API key
   */
  updateApiKey(newApiKey) {
    this.client.apiKey = newApiKey;
    this.client.httpClient.defaults.headers['X-API-Key'] = newApiKey;
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      baseURL: this.client.baseURL,
      timeout: this.client.timeout,
      maxRetries: this.client.maxRetries,
      hasApiKey: !!this.client.apiKey
    };
  }

  // Convenience methods that combine multiple service calls

  /**
   * Complete eSIM provisioning workflow
   * @param {Object} provisioningData - Provisioning parameters
   * @param {string} provisioningData.bundleId - Bundle to provision
   * @param {number} provisioningData.quantity - Quantity of eSIMs
   * @param {string} provisioningData.customerReference - Customer reference
   * @param {boolean} provisioningData.autoActivate - Auto-activate after provisioning
   * @returns {Promise<Object>} Provisioning result with order and eSIM details
   */
  async provisionESIM(provisioningData) {
    const {
      bundleId,
      quantity = 1,
      customerReference,
      autoActivate = false
    } = provisioningData;

    try {
      // Step 1: Create order
      const order = await this.orders.createOrder({
        items: [{ bundleId, quantity }],
        customerReference,
        allowReassign: true
      });

      // Step 2: Wait for order completion and get eSIM details
      let attempts = 0;
      const maxAttempts = 10;
      let orderDetails;

      do {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        orderDetails = await this.orders.getOrder(order.orderReference);
        attempts++;
      } while (orderDetails.status === 'pending' && attempts < maxAttempts);

      if (orderDetails.status !== 'completed') {
        throw new Error(`Order not completed: ${orderDetails.statusMessage}`);
      }

      // Step 3: Get install details
      const installDetails = await this.esims.getESIMInstallDetails({
        orderRef: order.orderReference
      });

      return {
        order: orderDetails,
        esims: orderDetails.esims || [],
        installDetails,
        provisioningComplete: true
      };

    } catch (error) {
      return {
        error: error.message,
        provisioningComplete: false
      };
    }
  }

  /**
   * Get comprehensive eSIM information
   * @param {string} iccid - eSIM ICCID
   * @returns {Promise<Object>} Complete eSIM information
   */
  async getESIMInfo(iccid) {
    try {
      const [esimDetails, bundles, usage] = await Promise.all([
        this.esims.getESIM(iccid),
        this.esims.getESIMBundles(iccid),
        this.esims.getESIMUsage(iccid).catch(() => null) // Usage might not be available
      ]);

      return {
        esim: esimDetails,
        bundles: bundles,
        usage: usage,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Search and compare bundles for destination
   * @param {string} destination - Destination country/region
   * @param {Object} preferences - User preferences
   * @param {number} preferences.dataAmount - Required data in MB
   * @param {number} preferences.maxPrice - Maximum price
   * @param {number} preferences.maxValidity - Maximum validity period
   * @returns {Promise<Object>} Recommended bundles
   */
  async findBestBundles(destination, preferences = {}) {
    try {
      // Search bundles for destination
      const searchResults = await this.bundles.searchBundles({
        destination,
        ...preferences
      });

      if (!searchResults.bundles || searchResults.bundles.length === 0) {
        return {
          destination,
          bundles: [],
          recommendations: []
        };
      }

      // Score bundles based on preferences
      const scoredBundles = searchResults.bundles.map(bundle => {
        let score = 0;
        
        // Price efficiency (data per dollar)
        if (bundle.dataAmount && bundle.price) {
          score += (bundle.dataAmount / bundle.price) * 10;
        }
        
        // Validity bonus
        if (bundle.validity >= 30) score += 5;
        if (bundle.validity >= 90) score += 5;
        
        // Regional vs single country bonus
        if (bundle.type === 'regional') score += 3;
        
        return { ...bundle, score };
      });

      // Sort by score descending
      scoredBundles.sort((a, b) => b.score - a.score);

      return {
        destination,
        bundles: searchResults.bundles,
        recommendations: scoredBundles.slice(0, 3),
        searchCriteria: preferences
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get account summary with key metrics
   * @returns {Promise<Object>} Account summary
   */
  async getAccountSummary() {
    try {
      const [account, balance, recentOrders] = await Promise.all([
        this.account.getAccount(),
        this.account.getBalance(),
        this.orders.getOrders({ limit: 5 })
      ]);

      const summary = {
        account: {
          id: account.id,
          name: account.name || account.companyName,
          email: account.email,
          status: account.status,
          createdAt: account.createdAt
        },
        balance: {
          current: balance.balance || balance.amount,
          currency: balance.currency || 'USD',
          lastUpdated: balance.lastUpdated || new Date().toISOString()
        },
        recentActivity: {
          totalOrders: recentOrders.totalCount || 0,
          recentOrders: recentOrders.orders?.slice(0, 5) || [],
          lastOrderDate: recentOrders.orders?.[0]?.createdDate || null
        }
      };

      return summary;

    } catch (error) {
      throw error;
    }
  }
}

// Export the main class and utilities
module.exports = ESIMGo;
module.exports.ESIMGo = ESIMGo;
module.exports.ESIMGoClient = ESIMGoClient;
module.exports.errors = require('./utils/errors');
module.exports.validators = require('./utils/validators');