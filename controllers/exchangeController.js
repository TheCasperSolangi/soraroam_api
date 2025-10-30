const axios = require("axios");
const redis = require("../config/redis");

const getExchangeRates = async (req, res) => {
  try {
    const { base = "USD", symbols = "" } = req.query;
    const cacheKey = `exchange:${base}:${symbols}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("✅ Served from Redis cache");
      return res.json(JSON.parse(cached));
    }

    // Fetch from ExchangeRate-API
    const apiKey = process.env.EXCHANGE_API_KEY;
    const url = `https://v6.exchangerate-api.com/v6/08313dded9adf5902ef1c354/latest/${base}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.result !== "success") {
      return res.status(400).json({ error: "Invalid API response" });
    }

    // Filter the requested symbols (if provided)
    let filteredRates = data.conversion_rates;
    if (symbols) {
      const requested = symbols.split(",").map((s) => s.trim().toUpperCase());
      filteredRates = Object.fromEntries(
        Object.entries(data.conversion_rates).filter(([key]) =>
          requested.includes(key)
        )
      );
    }

    const responseData = {
      base_code: data.base_code,
      last_update: data.time_last_update_utc,
      rates: filteredRates,
    };

    // Save to Redis (1 hour TTL)
    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 3600);

    console.log("🌐 Served from ExchangeRate-API");
    res.json(responseData);
  } catch (error) {
    console.error("❌ Exchange API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
};

module.exports = { getExchangeRates };
