const Countries = require("../models/countries");
const mongoose = require("mongoose");
const redis = require("../config/redis"); // your Redis setup file

const langs = ['EN', 'ES', 'FR'];

// Create a new country
const createCountry = async (req, res) => {
  try {
    const newCountry = new Countries(req.body);
    await newCountry.save();

    // Invalidate related caches for all languages
    for (const l of langs) {
      await redis.del(`countries:all:${l}`);
      await redis.del(`countries:region:${newCountry.region_code}:${l}`);
      await redis.del(`country:code:${newCountry.country_code}:${l}`);
      await redis.del(`country:id:${newCountry._id}:${l}`);
    }

    res.status(201).json({ success: true, data: newCountry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all countries with region info
const getAllCountries = async (req, res) => {
  try {
    const lang = (req.query.lang?.toUpperCase() || 'EN');
    const cacheKey = `countries:all:${lang}`;

    // ✅ Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    // Load translations if not English
    let countriesTrans;
    let regionTrans;
    if (lang === 'ES') {
      countriesTrans = require('../translations/countries_espanol');
      regionTrans = require('../translations/region_espanol');
    } else if (lang === 'FR') {
      countriesTrans = require('../translations/countries_french');
      regionTrans = require('../translations/region_french');
    }

    // Fetch from DB
    let countries = await Countries.aggregate([
      {
        $lookup: {
          from: "regions",
          localField: "region_code",
          foreignField: "region_code",
          as: "region"
        }
      },
      { $unwind: "$region" },
      {
        $group: {
          _id: "$country_code",
          country: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$country" } },
      { $sort: { country_name: 1 } }
    ]);

    // Apply translations if applicable
    if (countriesTrans && regionTrans) {
      countries = countries.map(country => {
        const countryT = countriesTrans[country.country_code];
        if (countryT) {
          country.country_name = countryT.country_name;
          country.country_description = countryT.country_description;
          country.country_short_desc = countryT.country_short_desc;
        }
        const regionT = regionTrans[country.region.region_code];
        if (regionT) {
          country.region.region_name = regionT.region_name;
          country.region.region_description = regionT.region_description;
        }
        return country;
      });
    }

    // ✅ Store in cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(countries), "EX", 600);

    res.status(200).json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get countries by region_code
const getCountriesByRegionCode = async (req, res) => {
  try {
    const { regionCode } = req.params;
    const lang = (req.query.lang?.toUpperCase() || 'EN');
    const cacheKey = `countries:region:${regionCode}:${lang}`;

    // ✅ Try Redis first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    // Load translations if not English
    let countriesTrans;
    let regionTrans;
    if (lang === 'ES') {
      countriesTrans = require('../translations/countries_espanol');
      regionTrans = require('../translations/region_espanol');
    } else if (lang === 'FR') {
      countriesTrans = require('../translations/countries_french');
      regionTrans = require('../translations/region_french');
    }

    let countries = await Countries.aggregate([
      { $match: { region_code: regionCode } },
      {
        $lookup: {
          from: "regions",
          localField: "region_code",
          foreignField: "region_code",
          as: "region"
        }
      },
      { $unwind: "$region" },
      {
        $group: {
          _id: "$country_code",
          country: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$country" } }
    ]);

    if (!countries.length) {
      return res.status(404).json({
        success: false,
        message: `No countries found for region code: ${regionCode}`
      });
    }

    // Apply translations if applicable
    if (countriesTrans && regionTrans) {
      countries = countries.map(country => {
        const countryT = countriesTrans[country.country_code];
        if (countryT) {
          country.country_name = countryT.country_name;
          country.country_description = countryT.country_description;
          country.country_short_desc = countryT.country_short_desc;
        }
        const regionT = regionTrans[country.region.region_code];
        if (regionT) {
          country.region.region_name = regionT.region_name;
          country.region.region_description = regionT.region_description;
        }
        return country;
      });
    }

    // ✅ Cache the result
    await redis.set(cacheKey, JSON.stringify(countries), "EX", 600);

    res.status(200).json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get country by ID
const getCountryById = async (req, res) => {
  try {
    const { id } = req.params;
    const lang = (req.query.lang?.toUpperCase() || 'EN');
    const cacheKey = `country:id:${id}:${lang}`;

    // ✅ Check Redis
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    // Load translations if not English
    let countriesTrans;
    let regionTrans;
    if (lang === 'ES') {
      countriesTrans = require('../translations/countries_espanol');
      regionTrans = require('../translations/region_espanol');
    } else if (lang === 'FR') {
      countriesTrans = require('../translations/countries_french');
      regionTrans = require('../translations/region_french');
    }

    let countries = await Countries.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "regions",
          localField: "region_code",
          foreignField: "region_code",
          as: "region"
        }
      },
      { $unwind: "$region" }
    ]);

    if (!countries.length) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    let result = countries[0];

    // Apply translations if applicable
    if (countriesTrans && regionTrans) {
      const countryT = countriesTrans[result.country_code];
      if (countryT) {
        result.country_name = countryT.country_name;
        result.country_description = countryT.country_description;
        result.country_short_desc = countryT.country_short_desc;
      }
      const regionT = regionTrans[result.region.region_code];
      if (regionT) {
        result.region.region_name = regionT.region_name;
        result.region.region_description = regionT.region_description;
      }
    }

    // ✅ Cache the result
    await redis.set(cacheKey, JSON.stringify(result), "EX", 600);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update country
const updateCountry = async (req, res) => {
  try {
    const updatedCountry = await Countries.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCountry) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    // Invalidate related caches for all languages
    for (const l of langs) {
      await redis.del(`countries:all:${l}`);
      await redis.del(`countries:region:${updatedCountry.region_code}:${l}`);
      await redis.del(`country:code:${updatedCountry.country_code}:${l}`);
      await redis.del(`country:id:${updatedCountry._id}:${l}`);
    }

    res.status(200).json({ success: true, data: updatedCountry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete country
const deleteCountry = async (req, res) => {
  try {
    const deletedCountry = await Countries.findByIdAndDelete(req.params.id);
    if (!deletedCountry) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    // Invalidate related caches for all languages
    for (const l of langs) {
      await redis.del(`countries:all:${l}`);
      await redis.del(`countries:region:${deletedCountry.region_code}:${l}`);
      await redis.del(`country:code:${deletedCountry.country_code}:${l}`);
      await redis.del(`country:id:${deletedCountry._id}:${l}`);
    }

    res.status(200).json({ success: true, message: "Country deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get country by country_code (deduped, always return one)
const getCountryByCountryCode = async (req, res) => {
  try {
    const { code } = req.params;
    const lang = (req.query.lang?.toUpperCase() || 'EN');
    const cacheKey = `country:code:${code}:${lang}`;

    // ✅ Check Redis
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    // Load translations if not English
    let countriesTrans;
    let regionTrans;
    if (lang === 'ES') {
      countriesTrans = require('../translations/countries_espanol');
      regionTrans = require('../translations/region_espanol');
    } else if (lang === 'FR') {
      countriesTrans = require('../translations/countries_french');
      regionTrans = require('../translations/region_french');
    }

    let countries = await Countries.aggregate([
      { $match: { country_code: code.toUpperCase() } },
      {
        $lookup: {
          from: "regions",
          localField: "region_code",
          foreignField: "region_code",
          as: "region"
        }
      },
      { $unwind: "$region" },
      {
        $group: {
          _id: "$country_code",
          country: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$country" } }
    ]);

    if (!countries.length) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    let result = countries[0];

    // Apply translations if applicable
    if (countriesTrans && regionTrans) {
      const countryT = countriesTrans[result.country_code];
      if (countryT) {
        result.country_name = countryT.country_name;
        result.country_description = countryT.country_description;
        result.country_short_desc = countryT.country_short_desc;
      }
      const regionT = regionTrans[result.region.region_code];
      if (regionT) {
        result.region.region_name = regionT.region_name;
        result.region.region_description = regionT.region_description;
      }
    }

    // ✅ Cache the result
    await redis.set(cacheKey, JSON.stringify(result), "EX", 600);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createCountry,
  getAllCountries,
  getCountryById,
  updateCountry,
  deleteCountry,
  getCountryByCountryCode,
  getCountriesByRegionCode
};