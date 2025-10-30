// Dynamic eSIM Plan Filtering System
// Handles dynamic plan availability and universal ULP/UL filtering

class ESIMPlanFilter {
  constructor() {
    // Universal filters that apply everywhere
    this.universalFilters = {
      excludeULP: true,  // Universal: Filter out ULP plans
      excludeUL: true    // Universal: Filter out UL (Unlimited) plans
    };
  }

  /**
   * Extract bundle type from plan name
   */
  getBundleType(plan) {
    if (plan.unlimited) {
      return plan.bundleType || 'unlimited';
    }
    
    const duration = plan.duration;
    const dataGB = plan.data_quantity / 1000; // Convert MB to GB
    return `${duration}days_${dataGB}gb`;
  }

  /**
   * Check if plan should be universally filtered
   */
  isUniversallyFiltered(plan) {
    const name = plan.name.toLowerCase();
    
    // Universal ULP filtering
    if (this.universalFilters.excludeULP && name.includes('ulp')) {
      return true;
    }
    
    // Universal UL filtering (unlimited plans)
    if (this.universalFilters.excludeUL) {
      if (plan.unlimited || name.includes('_ul') || name.includes('unlimited')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get all available bundle types across multiple countries
   */
  getAvailableBundleTypes(countriesData) {
    const bundleTypesByCountry = new Map();
    
    countriesData.forEach(countryData => {
      const countryName = countryData.country || countryData.region;
      const bundleTypes = new Set();
      
      countryData.bundles.forEach(plan => {
        // Skip universally filtered plans
        if (this.isUniversallyFiltered(plan)) {
          return;
        }
        
        const bundleType = this.getBundleType(plan);
        bundleTypes.add(bundleType);
      });
      
      bundleTypesByCountry.set(countryName, bundleTypes);
    });
    
    return bundleTypesByCountry;
  }

  /**
   * Find common bundle types supported by ALL countries
   */
  getCommonBundleTypes(bundleTypesByCountry) {
    if (bundleTypesByCountry.size === 0) return new Set();
    
    // Start with first country's bundle types
    const [firstCountry] = bundleTypesByCountry.values();
    const commonTypes = new Set(firstCountry);
    
    // Intersect with all other countries
    for (const [country, types] of bundleTypesByCountry) {
      const intersection = new Set();
      for (const type of commonTypes) {
        if (types.has(type)) {
          intersection.add(type);
        }
      }
      commonTypes.clear();
      intersection.forEach(type => commonTypes.add(type));
    }
    
    return commonTypes;
  }

  /**
   * Filter plans to only include those supported by ALL countries
   */
  filterCommonPlans(countriesData) {
    // Get bundle types by country
    const bundleTypesByCountry = this.getAvailableBundleTypes(countriesData);
    
    // Find common bundle types
    const commonBundleTypes = this.getCommonBundleTypes(bundleTypesByCountry);
    
    // Filter each country's plans
    const filteredData = countriesData.map(countryData => {
      const filteredBundles = countryData.bundles.filter(plan => {
        // Apply universal filters
        if (this.isUniversallyFiltered(plan)) {
          return false;
        }
        
        // Only include if bundle type is common across all countries
        const bundleType = this.getBundleType(plan);
        return commonBundleTypes.has(bundleType);
      });
      
      return {
        ...countryData,
        bundles: filteredBundles,
        original_count: countryData.bundles.length,
        filtered_count: filteredBundles.length,
        removed_count: countryData.bundles.length - filteredBundles.length
      };
    });
    
    return {
      countries: filteredData,
      commonBundleTypes: Array.from(commonBundleTypes).sort(),
      summary: {
        totalCountries: countriesData.length,
        commonPlansCount: commonBundleTypes.size,
        universalFilters: this.universalFilters
      }
    };
  }

  /**
   * Get detailed analysis of plan availability
   */
  analyzePlanAvailability(countriesData) {
    const bundleTypesByCountry = this.getAvailableBundleTypes(countriesData);
    const allBundleTypes = new Set();
    
    // Collect all unique bundle types
    bundleTypesByCountry.forEach(types => {
      types.forEach(type => allBundleTypes.add(type));
    });
    
    // Analyze each bundle type
    const analysis = Array.from(allBundleTypes).map(bundleType => {
      const availability = [];
      let supportCount = 0;
      
      bundleTypesByCountry.forEach((types, country) => {
        const isSupported = types.has(bundleType);
        availability.push({ country, supported: isSupported });
        if (isSupported) supportCount++;
      });
      
      return {
        bundleType,
        supportedByAll: supportCount === bundleTypesByCountry.size,
        supportCount,
        totalCountries: bundleTypesByCountry.size,
        availability
      };
    });
    
    return analysis.sort((a, b) => b.supportCount - a.supportCount);
  }
}

// Example Usage
const filter = new ESIMPlanFilter();

// Example: Asia region data (from your document)
const asiaData = {
  country: "Asia",
  region: "Asia",
  bundles: [
    // Your bundles array here
  ]
};

// Example: Multiple countries
const countriesData = [
  asiaData,
  // Add more country data...
];

// Filter to get only common plans
const result = filter.filterCommonPlans(countriesData);

console.log("Common Plans Summary:");
console.log(`- Countries analyzed: ${result.summary.totalCountries}`);
console.log(`- Common plan types: ${result.summary.commonPlansCount}`);
console.log(`- Universal filters: ULP=${result.summary.universalFilters.excludeULP}, UL=${result.summary.universalFilters.excludeUL}`);

console.log("\nCommon Bundle Types:");
result.commonBundleTypes.forEach(type => console.log(`  - ${type}`));

// Analyze plan availability across countries
const analysis = filter.analyzePlanAvailability(countriesData);
console.log("\nPlan Availability Analysis:");
analysis.forEach(item => {
  const status = item.supportedByAll ? "✓ AVAILABLE" : "✗ EXCLUDED";
  console.log(`${status}: ${item.bundleType} (${item.supportCount}/${item.totalCountries} countries)`);
});

// Export for use
export { ESIMPlanFilter };