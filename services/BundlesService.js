const { ValidationError } = require('../utils/errors');
const { validatePaginationParams } = require('../utils/validators');

class BundlesService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get available bundles catalog
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.country - Filter by country code
   * @param {string} options.region - Filter by region
   * @param {string} options.type - Filter by bundle type
   * @param {number} options.minPrice - Minimum price filter
   * @param {number} options.maxPrice - Maximum price filter
   * @returns {Promise<Object>} Bundles catalog
   */
  async getBundles(options = {}) {
    const {
      page = 1,
      limit = 50,
      country,
      region,
      type,
      minPrice,
      maxPrice
    } = options;

    validatePaginationParams(page, limit);

    const params = { page, limit };
    
    if (country) params.country = country;
    if (region) params.region = region;
    if (type) params.type = type;
    if (minPrice !== undefined) params.minPrice = minPrice;
    if (maxPrice !== undefined) params.maxPrice = maxPrice;

    return await this.client.get('/bundles', params);
  }

  /**
   * Get specific bundle details
   * @param {string} bundleId - Bundle identifier
   * @returns {Promise<Object>} Bundle details
   */
  async getBundle(bundleId) {
    if (!bundleId) {
      throw new ValidationError('Bundle ID is required');
    }

    return await this.client.get(`/bundles/${bundleId}`);
  }

  /**
   * Search bundles by criteria
   * @param {Object} searchCriteria - Search parameters
   * @param {string} searchCriteria.destination - Destination country/region
   * @param {number} searchCriteria.dataAmount - Required data amount in MB
   * @param {number} searchCriteria.validity - Required validity in days
   * @param {number} searchCriteria.maxPrice - Maximum price
   * @param {string} searchCriteria.currency - Currency code
   * @returns {Promise<Object>} Matching bundles
   */
  async searchBundles(searchCriteria) {
    if (!searchCriteria || Object.keys(searchCriteria).length === 0) {
      throw new ValidationError('Search criteria are required');
    }

    const params = {};
    
    if (searchCriteria.destination) {
      params.destination = searchCriteria.destination;
    }
    
    if (searchCriteria.dataAmount) {
      params.dataAmount = searchCriteria.dataAmount;
    }
    
    if (searchCriteria.validity) {
      params.validity = searchCriteria.validity;
    }
    
    if (searchCriteria.maxPrice) {
      params.maxPrice = searchCriteria.maxPrice;
    }
    
    if (searchCriteria.currency) {
      params.currency = searchCriteria.currency;
    }

    return await this.client.get('/bundles/search', params);
  }

  /**
   * Get bundles by country
   * @param {string} countryCode - ISO country code (e.g., 'US', 'GB', 'FR')
   * @param {Object} options - Additional options
   * @param {string} options.sortBy - Sort field ('price', 'data', 'validity')
   * @param {string} options.sortOrder - Sort order ('asc', 'desc')
   * @returns {Promise<Object>} Country-specific bundles
   */
  async getBundlesByCountry(countryCode, options = {}) {
    if (!countryCode || countryCode.length !== 2) {
      throw new ValidationError('Valid 2-letter country code is required');
    }

    const params = {
      country: countryCode.toUpperCase(),
      ...options
    };

    return await this.client.get('/bundles', params);
  }

  /**
   * Get bundles by region
   * @param {string} region - Region identifier
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Region-specific bundles
   */
  async getBundlesByRegion(region, options = {}) {
    if (!region) {
      throw new ValidationError('Region is required');
    }

    const params = {
      region,
      ...options
    };

    return await this.client.get('/bundles', params);
  }

  /**
   * Get bundle pricing for multiple quantities
   * @param {string} bundleId - Bundle identifier
   * @param {Array<number>} quantities - Array of quantities to check
   * @returns {Promise<Object>} Pricing information
   */
  async getBundlePricing(bundleId, quantities = [1, 5, 10]) {
    if (!bundleId) {
      throw new ValidationError('Bundle ID is required');
    }

    if (!Array.isArray(quantities) || quantities.length === 0) {
      throw new ValidationError('Quantities array is required');
    }

    const params = {
      bundleId,
      quantities: quantities.join(',')
    };

    return await this.client.get('/bundles/pricing', params);
  }

  /**
   * Check bundle compatibility with eSIM
   * @param {string} bundleId - Bundle identifier
   * @param {string} iccid - eSIM ICCID
   * @returns {Promise<Object>} Compatibility check result
   */
  async checkBundleCompatibility(bundleId, iccid) {
    if (!bundleId) {
      throw new ValidationError('Bundle ID is required');
    }

    if (!iccid) {
      throw new ValidationError('ICCID is required');
    }

    const params = {
      bundleId,
      iccid
    };

    return await this.client.get('/bundles/compatibility', params);
  }

  /**
   * Get popular/recommended bundles
   * @param {Object} options - Options
   * @param {string} options.category - Bundle category
   * @param {number} options.limit - Number of results
   * @returns {Promise<Object>} Popular bundles
   */
  async getPopularBundles(options = {}) {
    const params = {
      limit: options.limit || 10,
      popular: true
    };

    if (options.category) {
      params.category = options.category;
    }

    return await this.client.get('/bundles', params);
  }

  /**
   * Compare multiple bundles
   * @param {Array<string>} bundleIds - Array of bundle IDs to compare
   * @returns {Promise<Object>} Bundle comparison
   */
  async compareBundles(bundleIds) {
    if (!Array.isArray(bundleIds) || bundleIds.length < 2) {
      throw new ValidationError('At least 2 bundle IDs are required for comparison');
    }

    if (bundleIds.length > 10) {
      throw new ValidationError('Maximum 10 bundles can be compared at once');
    }

    const params = {
      bundleIds: bundleIds.join(',')
    };

    return await this.client.get('/bundles/compare', params);
  }

  /**
   * Get bundle categories
   * @returns {Promise<Object>} Available bundle categories
   */
  async getBundleCategories() {
    return await this.client.get('/bundles/categories');
  }

  /**
   * Get supported countries for bundles
   * @returns {Promise<Object>} Supported countries list
   */
  async getSupportedCountries() {
    return await this.client.get('/bundles/countries');
  }

  /**
   * Get supported regions for bundles
   * @returns {Promise<Object>} Supported regions list
   */
  async getSupportedRegions() {
    return await this.client.get('/bundles/regions');
  }
}

module.exports = BundlesService;