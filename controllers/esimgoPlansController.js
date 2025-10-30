const EsimgoPlan = require('../models/esimgo_plans');
const csv = require('csvtojson');
const redis = require('../config/redis');
// Updated Utility: Only remove null, undefined, empty, or 'NA' values, but keep 0
const cleanData = (data) => {
  const cleaned = {};
  for (const key in data) {
    if (
      data[key] !== null &&
      data[key] !== undefined &&
      data[key] !== '' &&
      data[key] !== 'NA' &&
      !(typeof data[key] === 'string' && data[key].trim() === '')
    ) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};
// Create or Update a plan (if exists)
exports.createPlan = async (req, res) => {
  try {
    let planData = req.body;

    if (!planData.country) {
      return res.status(400).json({ message: 'Country is required' });
    }

    // Clean out zero values
    planData = cleanData(planData);

    // Check if a plan already exists for this country
    const existing = await EsimgoPlan.findOne({ country: planData.country });

    if (existing) {
      // Update the existing plan
      const updatedPlan = await EsimgoPlan.findOneAndUpdate(
        { country: planData.country },
        { $set: planData },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        message: 'Existing plan updated successfully',
        plan: updatedPlan,
        updated: true
      });
    }

    // Otherwise create a new plan
    const newPlan = new EsimgoPlan(planData);
    await newPlan.save();

    res.status(201).json({
      message: 'Plan created successfully',
      plan: newPlan,
      created: true
    });
  } catch (error) {
    console.error('Error creating/updating plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all plans (with Redis caching)
exports.getAllPlans = async (req, res) => {
  try {
    const cacheKey = 'esimgo:plans:all';

    // Check if cache exists
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving plans from Redis cache');
      return res.status(200).json(JSON.parse(cachedData));
    }

    console.log('🧠 Cache miss: Fetching from MongoDB...');
    const plans = await EsimgoPlan.find().sort({ createdAt: -1 });

    // Round all numeric fields to 2 decimals before sending
    const roundedPlans = plans.map(plan => {
      const obj = plan.toObject();
      for (const key in obj) {
        if (typeof obj[key] === 'number') {
          obj[key] = parseFloat(obj[key].toFixed(2));
        }
      }
      return obj;
    });

    // Save to Redis cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(roundedPlans), 'EX', 600);

    res.status(200).json(roundedPlans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit / Update plan by ID
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    let updatedData = req.body;

    // Clean out zero values
    updatedData = cleanData(updatedData);

    const updatedPlan = await EsimgoPlan.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true
    });

    if (!updatedPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.status(200).json({ message: 'Plan updated successfully', plan: updatedPlan });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// More specific cleaning for bulk upload
const cleanDataForBulkUpload = (data) => {
  const cleaned = {};
  const fieldsToKeepEvenIfZero = ['30days_50gb', '30days_100gb']; // Add other fields if needed
  
  for (const key in data) {
    const shouldKeep = fieldsToKeepEvenIfZero.includes(key) 
      ? (data[key] !== null && data[key] !== undefined && data[key] !== '' && data[key] !== 'NA')
      : (data[key] !== 0 && data[key] !== '0' && data[key] !== null && data[key] !== undefined && data[key] !== '' && data[key] !== 'NA');
    
    if (shouldKeep) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};

// Bulk Upload CSV (Ignore 0 or empty)
exports.bulkUploadEsimgoPlans = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse CSV
    const jsonArray = await csv().fromFile(req.file.path);

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    console.log('Total rows in CSV:', jsonArray.length);

    for (const [index, row] of jsonArray.entries()) {
      try {
        const country = row['Countries']?.trim();
        if (!country) continue;

        // DEBUG: Log the raw CSV values for specific countries
        if (country === 'Argentina' || country === 'Russian Federation') {
          console.log(`\n--- DEBUG for ${country} ---`);
          console.log('30days 50 GB raw:', row['30days 50 GB']);
          console.log('100GB/30days (USD) raw:', row['100GB/30days (USD)']);
          console.log('30days 50 GB parsed:', parseFloat(row['30days 50 GB']));
          console.log('100GB/30days parsed:', parseFloat(row['100GB/30days (USD)']));
        }

        // Map CSV headers to DB fields
        let planData = {
          country: country,
          '7days_1gb': parseFloat(row['7days 1 GB']) || 0,
          '15days_2gb': parseFloat(row['15days 2 GB']) || 0,
          '30days_3gb': parseFloat(row['30days 3 GB']) || 0,
          '30days_5gb': parseFloat(row['30days 5 GB']) || 0,
          '30days_10gb': parseFloat(row['30days 10 GB']) || 0,
          '30days_20gb': parseFloat(row['30days 20 GB']) || 0,
          '30days_50gb': parseFloat(row['30days 50 GB']) || 0,
          '30days_100gb': parseFloat(row['100GB/30days (USD)']) || 0,
          '1_day_unlimited': parseFloat(row['UL/1day (USD)']) || 0,
          '3_day_unlimited': parseFloat(row['UL/3days (USD)']) || 0,
          '5_day_unlimited': parseFloat(row['UL/5days (USD)']) || 0,
          '7_day_unlimited': parseFloat(row['UL/7days (USD)']) || 0,
          '10_day_unlimited': parseFloat(row['UL/10days (USD)']) || 0,
          '15_day_unlimited': parseFloat(row['UL/15days (USD)']) || 0,
        };

        // DEBUG: Log before cleaning
        if (country === 'Argentina' || country === 'Russian Federation') {
          console.log('Before cleaning - 30days_50gb:', planData['30days_50gb']);
          console.log('Before cleaning - 30days_100gb:', planData['30days_100gb']);
        }

        // Remove all 0, empty, or NA fields
        planData = cleanData(planData);

        // DEBUG: Log after cleaning
        if (country === 'Argentina' || country === 'Russian Federation') {
          console.log('After cleaning - 30days_50gb:', planData['30days_50gb']);
          console.log('After cleaning - 30days_100gb:', planData['30days_100gb']);
          console.log('All fields after cleaning:', Object.keys(planData));
        }

        // Skip if nothing to insert (only country field remains)
        if (Object.keys(planData).length <= 1) continue;

        const existing = await EsimgoPlan.findOne({ country: planData.country });

        if (existing) {
          await EsimgoPlan.findOneAndUpdate(
            { country: planData.country },
            { $set: planData },
            { new: true, runValidators: true }
          );
          updatedCount++;
        } else {
          const newPlan = new EsimgoPlan(planData);
          await newPlan.save();
          createdCount++;
        }
      } catch (err) {
        console.error('Error processing row for country:', country, err);
        failedCount++;
      }
    }

    res.status(200).json({
      message: 'Bulk upload completed',
      summary: {
        created: createdCount,
        updated: updatedCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};