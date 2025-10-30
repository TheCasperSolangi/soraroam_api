const axios = require("axios");
const redis = require("../config/redis"); // your Redis setup file
// ✅ Country pricing - will be fetched from API
let COUNTRY_PRICING = {};

// ✅ Function to fetch country pricing from API
const fetchKeepgoPricingFromAPI = async () => {
  try {
    console.log("🌍 Fetching KeepGo country pricing from API...");
    const response = await axios.get('https://api.soraroam.com/api/plans/keepgo', {
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      // Transform API response to match our expected format
      COUNTRY_PRICING = {};
      response.data.forEach(item => {
        if (item.country) {
          COUNTRY_PRICING[item.country] = {
            "7days_1gb": item["7days_1gb"],
            "30days_3gb": item["30days_3gb"],
            "30days_5gb": item["30days_5gb"],
            "30days_10gb": item["30days_10gb"],
            "30days_20gb": item["30days_20gb"]
          };
        }
      });
      
      console.log(`✅ Successfully fetched KeepGo pricing for ${Object.keys(COUNTRY_PRICING).length} countries from API`);
      return COUNTRY_PRICING;
    } else {
      console.warn("⚠️ KeepGo API returned unexpected data format");
      return {};
    }
  } catch (error) {
    console.error("❌ Error fetching KeepGo country pricing from API:", error.message);
    return {};
  }
};

// ✅ Initialize pricing on startup
const initializeKeepgoPricing = async () => {
  await fetchKeepgoPricingFromAPI();
  
  // Refresh pricing every hour
  setInterval(fetchKeepgoPricingFromAPI, 60 * 60 * 1000);
};

// ✅ Helper to normalize Keepgo refills into target structure
const normalizeKeepgoRefills = (bundle, countryPricing = {}) => {
  const country = bundle.name;
  const region = "Europe"; // (can be dynamic if you want)

  // ✅ Filter out refills not in COUNTRY_PRICING
  const filteredRefills = bundle.refills.filter((refill) => {
    const { amount_mb, amount_days } = refill;
    const gbValue = amount_mb >= 1024 ? Math.round(amount_mb / 1024) : amount_mb;
    const bundleTypeKey = `${amount_days}days_${gbValue}gb`;
    return countryPricing.hasOwnProperty(bundleTypeKey);
  });

  return filteredRefills.map((refill, index) => {
    const { title, amount_mb, amount_days, price_usd } = refill;
    const gbValue = amount_mb >= 1024 ? Math.round(amount_mb / 1024) : amount_mb;
    const bundleTypeKey = `${amount_days}days_${gbValue}gb`;

    // ✅ Apply custom price and round to 2 decimals
    const customPrice = Number(parseFloat(countryPricing[bundleTypeKey] || price_usd).toFixed(2));

    const markup = customPrice - price_usd;
    const markupPercentage = price_usd > 0 ? ((markup / price_usd) * 100).toFixed(2) : 0;

    return {
      bundle_id: `keepgo_${country.substring(0, 2).toUpperCase()}_${index + 1}`,
      provider: "keepgo",
      provider_id: bundle.id,
      description: `eSIM, ${title}, ${country}`,
      picture: bundle.img,
      data_quantity: gbValue,
      provider_data: amount_mb,
      duration: amount_days,
      price: customPrice,
      countries: [country],
      region,
      speed: ["2G", "3G", "4G"],
      autostart: true,
      unlimited: false,
      billingType: "FixedCost",
      originalPrice: price_usd,
      pricingInfo: {
        country,
        bundleType: bundleTypeKey,
        originalPrice: price_usd,
        customPrice,
        markup,
        markupPercentage: Number(markupPercentage),
        pricingSource: countryPricing[bundleTypeKey] ? "country-specific" : "api-default",
      },
      bundleType: bundleTypeKey,
    };
  });
};

// ✅ Controller
const getKeepgoBundles = async (req, res) => {
  try {
    const { countryCode } = req.query;

    const cacheKey = `keepgo_bundles_${countryCode ? countryCode.toUpperCase() : 'all'}`;

    // Check Redis cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("🌍 Cache hit for Keepgo bundles");
      const parsed = JSON.parse(cachedData);
      if (!countryCode) {
        return res.status(200).json({
          success: true,
          message: "Bundles fetched successfully (regional removed)",
          total: parsed.length,
          data: parsed,
        });
      } else {
        return res.status(200).json({
          message: "Catalogue fetched successfully",
          total: parsed.length,
          bundles: parsed,
        });
      }
    }

    const config = {
      method: "get",
      maxBodyLength: Infinity,
      url: "https://myaccount.keepgo.com/api/v2/bundles",
      headers: {
        apiKey: "39417e7623d65cc293003cfe425bacc0",
        accessToken: "d6UaypRMqVe55/dtFdfgQP+Nvy4=",
        Cookie: "gb2go_currency=usd",
      },
    };

    const response = await axios.request(config);
    const bundles = response.data?.bundles || [];

    // ✅ Remove regional bundles
    const nonRegional = bundles.filter((b) => b.bundle_type !== "regional");

    // ✅ No query? return all non-regional
    if (!countryCode) {
      // Cache the data
      await redis.set(cacheKey, JSON.stringify(nonRegional), 'EX', 3600); // Cache for 1 hour
      return res.status(200).json({
        success: true,
        message: "Bundles fetched successfully (regional removed)",
        total: nonRegional.length,
        data: nonRegional,
      });
    }

    // ✅ Country code mapping
    const countryNameMap = {
      AL: "Albania",
      DZ: "Algeria",
      AD: "Andorra",
      AI: "Anguilla",
      AG: "Antigua & Barbuda",
      AM: "Armenia",
      AZ: "Azerbaijan",
      BH: "Bahrain",
      BD: "Bangladesh",
      BB: "Barbados",
      BY: "Belarus",
      BJ: "Benin",
      BR: "Brazil",
      KH: "Cambodia",
      KY: "Cayman Islands",
      CL: "Chile",
      CN: "China",
      DM: "Dominica",
      DO: "Dominican Republic",
      FO: "Faroe Islands",
      FJ: "Fiji",
      GF: "French Guiana",
      GA: "Gabon",
      GE: "Georgia",
      GH: "Ghana",
      GI: "Gibraltar",
      GD: "Grenada",
      GP: "Guadeloupe",
      GT: "Guatemala",
      GN: "Guinea",
      GW: "Guinea-Bissau",
      HT: "Haiti",
      HN: "Honduras",
      IN: "India",
      IQ: "Iraq",
      JM: "Jamaica",
      JE: "Jersey",
      KZ: "Kazakhstan",
      KE: "Kenya",
      XK: "Kosovo",
      KW: "Kuwait",
      KG: "Kyrgyzstan",
      LA: "Laos",
      LR: "Liberia",
      MK: "North Macedonia",
      MG: "Madagascar",
      MW: "Malawi",
      MY: "Malaysia",
      MQ: "Martinique",
      MX: "Mexico",
      MD: "Moldova",
      MN: "Mongolia",
      ME: "Montenegro",
      MS: "Montserrat",
      NI: "Nicaragua",
      OM: "Oman",
      PK: "Pakistan",
      TC: "Turks and Caicos Islands Carib",
      PG: "Papua New Guinea",
      PE: "Peru",
      PH: "Philippines",
      QA: "Qatar",
      RW: "Rwanda",
      KN: "Saint Kitts And Nevis",
      LC: "Saint Lucia",
      VC: "Saint Vincent And The Grenadines",
      WS: "Samoa",
      SC: "Seychelles",
      ZA: "South Africa",
      TJ: "Tajikistan",
      TZ: "Tanzania",
      TO: "Tonga",
      UG: "Uganda",
      UZ: "Uzbekistan"
    };

    const targetCountry = countryNameMap[countryCode.toUpperCase()];
    if (!targetCountry) {
      return res.status(404).json({
        success: false,
        message: `Country not supported or mapping missing for code: ${countryCode}`,
      });
    }

    // ✅ Find the bundle for that country
    const countryBundle = nonRegional.find(
      (b) =>
        b.bundle_type === "country" &&
        b.name.toLowerCase() === targetCountry.toLowerCase()
    );

    if (!countryBundle) {
      return res.status(404).json({
        success: false,
        message: `No bundle found for ${targetCountry}`,
      });
    }

    // ✅ Apply pricing + normalize (only include supported plans)
    const pricing = COUNTRY_PRICING[targetCountry] || {};
    const normalizedBundles = normalizeKeepgoRefills(countryBundle, pricing);

    // Cache the data
    await redis.set(cacheKey, JSON.stringify(normalizedBundles), 'EX', 3600); // Cache for 1 hour

    res.status(200).json({
      message: "Catalogue fetched successfully",
      total: normalizedBundles.length,
      bundles: normalizedBundles,
    });
  } catch (error) {
    console.error("❌ Error fetching Keepgo bundles:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bundles",
      error: error.message,
    });
  }
};

// ✅ Helper: normalize a single refill
const normalizeSingleRefill = (bundle, refill) => {
  const country = bundle.coverage?.[0] || bundle.name;
  const flag = bundle.networks?.[0]?.flag || null;
  const networks = bundle.networks?.[0]?.local_networks || [];
  const provider = "keepgo";

  const gb = (refill.amount_mb / 1024).toFixed(2).replace(".00", "");
  const days = refill.amount_days;
  const bundleType = `${days}days_${gb.toLowerCase()}gb`;
  
  // ✅ Get custom price from COUNTRY_PRICING
  const countryPricing = COUNTRY_PRICING[country] || {};
  const customPrice = Number((countryPricing[bundleType] || refill.price_usd).toFixed(2));
  const originalPrice = Number(refill.price_usd.toFixed(2));

  return {
    message: "Bundle fetched successfully",
    bundle: {
      name: `esim_${gb}GB_${days}D_${country.replace(/\s/g, "_")}`,
      description: `eSIM, ${gb}GB, ${days} Days, ${country}`,
      provider,
      picture: flag,
      price: customPrice,
      data_quantity: refill.amount_mb,
      duration: days,
      speed: ["3G", "4G", "5G"],
      autostart: true,
      unlimited: false,
      billingType: "FixedCost",
      group: ["Standard Fixed"],
      countries: [
        {
          name: country,
          iso: null,
          region: null,
          networks: networks.map((n) => ({
            name: n,
            brand: n,
            speeds: ["3G", "4G", "5G"],
          })),
        },
      ],
      allowances: [
        {
          type: "DATA",
          service: "ROAMING",
          description: `${gb}GB_${days}D_${country}`,
          amount: refill.amount_mb,
          unit: "MB",
          unlimited: false,
        },
      ],
      region: null,
      originalPrice,
      pricingInfo: {
        country,
        bundleType,
        originalPrice,
        customPrice,
        markup: customPrice - originalPrice,
        markupPercentage: originalPrice > 0 ? ((customPrice - originalPrice) / originalPrice * 100).toFixed(2) : 0,
        pricingSource: countryPricing[bundleType] ? "country-specific" : "api-default",
      },
    },
  };
};

// ✅ Controller: fetch bundle by ID and normalize selected refill
const getSpecificDataPlan = async (req, res) => {
  try {
    const { id, data, duration } = req.query;

    if (!id || !data || !duration) {
      return res.status(400).json({
        success: false,
        message: "id, data (MB), and duration (days) are required (e.g. ?id=207&data=3072&duration=30)",
      });
    }

    const config = {
      method: "get",
      url: `https://myaccount.keepgo.com/api/v2/bundles/${id}`,
      headers: {
        apiKey: "39417e7623d65cc293003cfe425bacc0",
        accessToken: "d6UaypRMqVe55/dtFdfgQP+Nvy4=",
      },
    };

    const response = await axios.request(config);
    const bundle = response.data?.bundle;

    if (!bundle || !bundle.refills?.length) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found or has no refills",
      });
    }

    // ✅ Find the matching refill by data and duration
    const match = bundle.refills.find(
      (r) =>
        Math.round(r.amount_mb) === Math.round(Number(data)) &&
        Number(r.amount_days) === Number(duration)
    );

    if (!match) {
      return res.status(404).json({
        success: false,
        message: `No refill found for ${data}MB / ${duration} days`,
      });
    }

    const normalized = normalizeSingleRefill(bundle, match);
    return res.status(200).json(normalized);
  } catch (error) {
    console.error("Error fetching specific data plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch specific bundle",
      error: error.message,
    });
  }
};

module.exports = { 
  getKeepgoBundles, 
  getSpecificDataPlan,
  fetchKeepgoPricingFromAPI,
  initializeKeepgoPricing,
  COUNTRY_PRICING 
};