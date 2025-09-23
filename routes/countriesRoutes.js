const express = require("express");
const router = express.Router();
const {
  createCountry,
  getAllCountries,
  getCountryById,
  updateCountry,
  deleteCountry,
  getCountryByCountryCode,
  getCountriesByRegionCode
} = require("../controllers/countriesController");

// Routes
router.post("/", createCountry);          // Create new country
router.get("/", getAllCountries);         // Get all countries
router.get("/region/:regionCode", getCountriesByRegionCode)
router.get("/:id", getCountryById);       // Get single country
router.put("/:id", updateCountry);        // Update country
router.delete("/:id", deleteCountry);     // Delete country
router.get("/code/:code", getCountryByCountryCode); // ✅ new route

module.exports = router;
