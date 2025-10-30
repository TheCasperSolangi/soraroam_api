const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');
const KeepgoPlan = require('../models/keepgoPlans');
const redis = require('../config/redis'); // ✅ Redis client
// Utility: Remove fields that are 0, null, undefined, or empty string
// Utility to remove zero/empty values

// Clean data (ignore zeros, null, etc.)
const cleanData = (data) => {
  const cleaned = {};
  for (const key in data) {
    const value = Number(data[key]) || data[key];
    if (
      value !== 0 &&
      value !== '0' &&
      value !== '' &&
      value !== null &&
      value !== undefined
    ) {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

// Multer setup for CSV upload
const upload = multer({ dest: 'uploads/' });
exports.uploadCSV = upload.single('file');


// Bulk upload with header mapping
exports.bulkUploadPlans = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' }))
      .on('data', (row) => results.push(row))
      .on('end', async () => {
        console.log('Parsed CSV rows:', results.length);

        const summary = { created: 0, updated: 0, failed: 0 };

        for (const r of results) {
          try {
            // Map your CSV columns to your schema fields
            const planData = cleanData({
              country: r['Countries']?.trim(),
              '7days_1gb': Number(r['7days 1 GB']),
              '30days_3gb': Number(r['30days 3 GB']),
              '30days_5gb': Number(r['30days 5 GB']),
              '30days_10gb': Number(r['30days 10 GB']),
              '30days_20gb': Number(r['30days 20 GB'])
            });

            if (!planData.country) continue;

            const existing = await KeepgoPlan.findOne({ country: planData.country });

            if (existing) {
              await KeepgoPlan.findOneAndUpdate(
                { country: planData.country },
                { $set: planData },
                { new: true, runValidators: true }
              );
              summary.updated++;
            } else {
              const newPlan = new KeepgoPlan(planData);
              await newPlan.save();
              summary.created++;
            }
          } catch (err) {
            console.error('Failed row:', r, err.message);
            summary.failed++;
          }
        }

        fs.unlinkSync(filePath);
        res.status(200).json({
          message: 'Bulk upload completed',
          summary
        });
      });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Create or Update a Keepgo plan (if exists)
exports.createPlan = async (req, res) => {
  try {
    let planData = req.body;

    if (!planData.country) {
      return res.status(400).json({ message: 'Country is required' });
    }

    // Clean out zero values
    planData = cleanData(planData);

    // Check if plan already exists
    const existing = await KeepgoPlan.findOne({ country: planData.country });

    if (existing) {
      // Update existing plan
      const updatedPlan = await KeepgoPlan.findOneAndUpdate(
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

    // Otherwise create a new one
    const newPlan = new KeepgoPlan(planData);
    await newPlan.save();

    res.status(201).json({
      message: 'Plan created successfully',
      plan: newPlan,
      created: true
    });
  } catch (error) {
    console.error('Error creating/updating Keepgo plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all Keepgo plans (with Redis caching)
exports.getAllPlans = async (req, res) => {
  try {
    const cacheKey = 'keepgo:plans:all';

    // ✅ Try Redis cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('📦 Serving Keepgo plans from Redis cache');
      return res.status(200).json(JSON.parse(cachedData));
    }

    console.log('🧠 Cache miss: Fetching Keepgo plans from MongoDB...');
    const plans = await KeepgoPlan.find().sort({ createdAt: -1 });

    const roundedPlans = plans.map(plan => {
      const obj = plan.toObject();
      for (const key in obj) {
        if (typeof obj[key] === 'number') {
          obj[key] = parseFloat(obj[key].toFixed(2));
        }
      }
      return obj;
    });

    // ✅ Store in Redis for 10 minutes
    await redis.set(cacheKey, JSON.stringify(roundedPlans), 'EX', 600);

    res.status(200).json(roundedPlans);
  } catch (error) {
    console.error('Error fetching Keepgo plans:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update Keepgo plan by ID
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    let updatedData = req.body;

    // Clean out zero values
    updatedData = cleanData(updatedData);

    const updatedPlan = await KeepgoPlan.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true
    });

    if (!updatedPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.status(200).json({ message: 'Plan updated successfully', plan: updatedPlan });
  } catch (error) {
    console.error('Error updating Keepgo plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
