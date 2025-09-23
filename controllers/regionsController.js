const Regions = require('../models/regions');

// Create a new region
const createRegion = async (req, res) => {
    try {
        const { region_code, region_name, region_description, region_flag, region_cover_picture } = req.body;
        const newRegion = new Regions({ region_code, region_name, region_description, region_flag, region_cover_picture });
        await newRegion.save();
        res.status(201).json({ success: true, data: newRegion });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all regions
const getAllRegions = async (req, res) => {
    try {
        const regions = await Regions.find();
        res.status(200).json({ success: true, data: regions });
    } catch (error) {
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
        const updatedRegion = await Regions.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedRegion) return res.status(404).json({ success: false, message: "Region not found" });
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
    deleteRegion
};
