const { ValidationError } = require('../utils/errors');
const { validatePaginationParams, validateIccid } = require('../utils/validators');

class ESIMsService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get list of eSIMs with pagination
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10)
   * @param {string} options.status - Filter by eSIM status
   * @param {string} options.profileStatus - Filter by profile status
   * @returns {Promise<Object>} eSIMs list with pagination
   */
  async getESIMs(options = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      profileStatus
    } = options;

    validatePaginationParams(page, limit);

    const params = { page, limit };
    
    if (status) params.status = status;
    if (profileStatus) params.profileStatus = profileStatus;

    return await this.client.get('/esims', params);
  }

  /**
   * Get specific eSIM details by ICCID
   * @param {string} iccid - eSIM ICCID
   * @returns {Promise<Object>} eSIM details
   */
  async getESIM(iccid) {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    return await this.client.get(`/esims/${iccid}`);
  }

  /**
   * Update eSIM details
   * @param {string} iccid - eSIM ICCID
   * @param {Object} updateData - Data to update
   * @param {string} updateData.customerReference - Customer reference
   * @param {string} updateData.alias - eSIM alias/name
   * @param {Object} updateData.metadata - Additional metadata
   * @returns {Promise<Object>} Updated eSIM details
   */
  async updateESIM(iccid, updateData) {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new ValidationError('Update data is required');
    }

    return await this.client.put(`/esims/${iccid}`, updateData);
  }

  /**
   * Get eSIM install details (QR codes, SMDP+ info)
   * @param {Object} references - Order or Apply references
   * @param {string|Array} references.orderRef - Order reference(s)
   * @param {string|Array} references.applyRef - Apply reference(s)
   * @param {string} format - Response format ('json' or 'zip')
   * @returns {Promise<Object|Buffer>} Install details or QR code ZIP
   */
  async getESIMInstallDetails(references, format = 'json') {
    if (!references || (!references.orderRef && !references.applyRef)) {
      throw new ValidationError('At least one reference (orderRef or applyRef) is required');
    }

    const params = {};
    
    if (references.orderRef) {
      params.orderRef = Array.isArray(references.orderRef) 
        ? references.orderRef.join(',') 
        : references.orderRef;
    }
    
    if (references.applyRef) {
      params.applyRef = Array.isArray(references.applyRef)
        ? references.applyRef.join(',')
        : references.applyRef;
    }

    const headers = format === 'zip' ? { Accept: 'application/zip' } : {};

    return await this.client.get('/esims/assignments', params, headers);
  }

  /**
   * Get eSIM bundles for specific ICCID
   * @param {string} iccid - eSIM ICCID
   * @param {Object} options - Query options
   * @param {boolean} options.includeExpired - Include expired bundles
   * @returns {Promise<Object>} eSIM bundles
   */
  async getESIMBundles(iccid, options = {}) {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    const params = {
      includeExpired: options.includeExpired || false
    };

    return await this.client.get(`/esims/${iccid}/bundles`, params);
  }

  /**
   * Assign bundle to eSIM
   * @param {string} iccid - eSIM ICCID
   * @param {Object} bundleData - Bundle assignment data
   * @param {string} bundleData.bundleId - Bundle identifier
   * @param {number} bundleData.quantity - Quantity to assign
   * @param {boolean} bundleData.autoActivate - Auto-activate after assignment
   * @returns {Promise<Object>} Assignment result
   */
  async assignBundleToESIM(iccid, bundleData) {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    if (!bundleData || !bundleData.bundleId) {
      throw new ValidationError('Bundle ID is required');
    }

    if (!bundleData.quantity || bundleData.quantity < 1) {
      throw new ValidationError('Valid quantity is required');
    }

    return await this.client.post(`/esims/${iccid}/bundles`, bundleData);
  }

  /**
   * Suspend eSIM
   * @param {string} iccid - eSIM ICCID
   * @param {string} reason - Suspension reason
   * @returns {Promise<Object>} Suspension result
   */
  async suspendESIM(iccid, reason = 'User requested suspension') {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    return await this.client.post(`/esims/${iccid}/suspend`, { reason });
  }

  /**
   * Resume suspended eSIM
   * @param {string} iccid - eSIM ICCID
   * @returns {Promise<Object>} Resume result
   */
  async resumeESIM(iccid) {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    return await this.client.post(`/esims/${iccid}/resume`);
  }

  /**
   * Get eSIM usage statistics
   * @param {string} iccid - eSIM ICCID
   * @param {Object} options - Query options
   * @param {string} options.startDate - Start date for usage data
   * @param {string} options.endDate - End date for usage data
   * @returns {Promise<Object>} Usage statistics
   */
  async getESIMUsage(iccid, options = {}) {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    const params = {};
    
    if (options.startDate) params.startDate = options.startDate;
    if (options.endDate) params.endDate = options.endDate;

    return await this.client.get(`/esims/${iccid}/usage`, params);
  }

  /**
   * Delete/deactivate eSIM
   * @param {string} iccid - eSIM ICCID
   * @param {string} reason - Deletion reason
   * @returns {Promise<Object>} Deletion result
   */
  async deleteESIM(iccid, reason = 'User requested deletion') {
    if (!validateIccid(iccid)) {
      throw new ValidationError('Invalid ICCID format');
    }

    return await this.client.delete(`/esims/${iccid}`, { reason });
  }
}

module.exports = ESIMsService;