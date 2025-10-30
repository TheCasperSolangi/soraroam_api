const Regions = require('../models/regions');
const redis = require('../config/redis'); // your redis.js file
const regionFrench = require('../translations/region_french');
const regionSpanish = require('../translations/region_espanol');

const CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

// Create a new region
const createRegion = async (req, res) => {
  try {
    const { region_code, region_name, region_description, region_flag, region_cover_picture } = req.body;
    const newRegion = new Regions({ region_code, region_name, region_description, region_flag, region_cover_picture });
    await newRegion.save();

    // Clear cached data after region creation
    await redis.del('regions:EN');
    await redis.del('regions:FR');
    await redis.del('regions:ES');

    res.status(201).json({ success: true, data: newRegion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all regions (with translations + Redis cache)
const getAllRegions = async (req, res) => {
  try {
    const { language = 'EN' } = req.query;
    const lang = language.toUpperCase();
    const cacheKey = `regions:${lang}`;

    // 1️⃣ Try to get cached data
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`🧠 Cache hit for ${cacheKey}`);
      return res.status(200).json({ success: true, data: JSON.parse(cached) });
    }

    console.log(`🧩 Cache miss for ${cacheKey}. Fetching from DB...`);
    const regions = await Regions.find();

    // 2️⃣ Apply translation based on language
    let translatedData = regions.map((region) => {
      const regionObj = region.toObject();
      let translation = null;

      if (lang === 'FR') translation = regionFrench[region.region_code];
      else if (lang === 'ES') translation = regionSpanish[region.region_code];

      if (translation) {
        regionObj.region_name = translation.region_name;
        regionObj.region_description = translation.region_description;
      }

      return regionObj;
    });

    // 3️⃣ Save translated data in Redis for 30 days
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(translatedData));
    console.log(`💾 Cached ${cacheKey} for 30 days`);

    res.status(200).json({ success: true, data: translatedData });
  } catch (error) {
    console.error('❌ Error fetching regions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single region by ID
const getRegionById = async (req, res) => {
  try {
    const region = await Regions.findById(req.params.id);
    if (!region) return res.status(404).json({ success: false, message: "Region not found" });
    res.status(200).json({ success: true, data: region });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a region by ID
const updateRegion = async (req, res) => {
  try {
    const updatedRegion = await Regions.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedRegion) return res.status(404).json({ success: false, message: "Region not found" });

    // Clear cache after update
    await redis.del('regions:EN');
    await redis.del('regions:FR');
    await redis.del('regions:ES');

    res.status(200).json({ success: true, data: updatedRegion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a region by ID
const deleteRegion = async (req, res) => {
  try {
    const deletedRegion = await Regions.findByIdAndDelete(req.params.id);
    if (!deletedRegion) return res.status(404).json({ success: false, message: "Region not found" });

    // Clear cache after deletion
    await redis.del('regions:EN');
    await redis.del('regions:FR');
    await redis.del('regions:ES');

    res.status(200).json({ success: true, message: "Region deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createRegion,
  getAllRegions,
  getRegionById,
  updateRegion,
  deleteRegion,
};
