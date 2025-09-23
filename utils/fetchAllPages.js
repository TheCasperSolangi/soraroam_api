// utils/fetchAllPages.js
const axios = require("axios");

const fetchAllPages = async (url, config = {}) => {
  let results = [];
  let currentUrl = url;

  while (currentUrl) {
    try {
      const response = await axios.get(currentUrl, config);
      results = results.concat(response.data.data || response.data); // Adjust based on API response structure
      currentUrl = response.data.next || null; // Adjust based on API pagination (e.g., 'next' link)
    } catch (err) {
      throw new Error(`API request failed: ${err.response?.data?.message || err.message}`);
    }
  }

  return results;
};

module.exports = fetchAllPages;