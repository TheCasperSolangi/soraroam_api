const Countries = require("../models/countries");

// Create a new country
const createCountry = async (req, res) => {
  try {
    const newCountry = new Countries(req.body);
    await newCountry.save();
    // populate region after creation
    await newCountry
    res.status(201).json({ success: true, data: newCountry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
// Get all countries with region info (deduped by country_code)
const getAllCountries = async (req, res) => {
  try {
    const countries = await Countries.aggregate([
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

    res.status(200).json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get countries by region_code with region info (deduped)
const getCountriesByRegionCode = async (req, res) => {
  try {
    const { regionCode } = req.params;

    const countries = await Countries.aggregate([
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

    res.status(200).json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get country by ID with region info
const getCountryById = async (req, res) => {
  try {
    const countries = await Countries.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
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

    res.status(200).json({ success: true, data: countries[0] });
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
    ).populate('region'); // populate after update
    if (!updatedCountry) {
      return res.status(404).json({ success: false, message: "Country not found" });
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
    res.status(200).json({ success: true, message: "Country deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get country by country_code (deduped, always return one)
const getCountryByCountryCode = async (req, res) => {
  try {
    const { code } = req.params;

    const countries = await Countries.aggregate([
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

    res.status(200).json({ success: true, data: countries[0] });
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
