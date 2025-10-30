const express = require('express');
const axios = require('axios');
const User = require('../models/User'); // Adjust path as needed
const Orders = require('../models/Order'); // Adjust path as needed
const bcrypt = require("bcryptjs");
const router = express.Router();
// GET /api/user/summary/:username
router.get('/summary/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Fetch user details
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Fetch user's orders to get eSIM data
    const orders = await Orders.find({ username, status: { $in: ['completed', 'active'] } });
    
    // Extract all eSIMs from orders
    const allEsims = [];
    const countriesSet = new Set();
    
    orders.forEach(order => {
      order.order.forEach(orderItem => {
        if (orderItem.esims && orderItem.esims.length > 0) {
          orderItem.esims.forEach(esim => {
            allEsims.push({
              iccid: esim.iccid,
              matchingId: esim.matchingId,
              smdpAddress: esim.smdpAddress,
              type: orderItem.type,
              item: orderItem.item
            });
          });
        }
      });
    });

    // 3. Get data usage from external API for all eSIMs
    let totalDataUsed = 0;
    let latestEsimData = null;
    let latestDataUsage = null;

    // Process each eSIM to get usage data
    for (const esim of allEsims) {
      try {
        // Extract bundle name from item or use a default pattern
        const bundleName = esim.item || 'default_bundle';
        
        const response = await axios.get(
          `https://api.esim-go.com/v2.5/esims/${esim.iccid}/bundles/${bundleName}`,
          {
            headers: {
              'X-API-Key': 'xiLA6SF1vErv81g1n2R1DfJXzX6oxfHh7gjLEmWR' // Make sure to set this in your environment
            }
          }
        );

        if (response.data && response.data.assignments && response.data.assignments.length > 0) {
          const assignment = response.data.assignments[0];
          const allowance = assignment.allowances[0];
          
          if (allowance) {
            const dataUsed = allowance.initialAmount - allowance.remainingAmount;
            totalDataUsed += dataUsed;

            // Store the latest/most recent eSIM data for summary
            if (!latestEsimData) {
              latestEsimData = {
                plan_name: assignment.name,
                iccid: esim.iccid,
                data: `${(allowance.initialAmount / (1024 * 1024 * 1024)).toFixed(2)}GB`,
                is_unlimited: allowance.unlimited || false
              };

              latestDataUsage = {
                data_used: `${(dataUsed / (1024 * 1024 * 1024)).toFixed(2)}GB`,
                data_remaining: `${(allowance.remainingAmount / (1024 * 1024 * 1024)).toFixed(2)}GB`,
                data_total: `${(allowance.initialAmount / (1024 * 1024 * 1024)).toFixed(2)}GB`
              };
            }

            // Extract country info (you might need to adjust this based on your item naming convention)
            if (esim.item) {
              // Assuming item contains country code like "esim_1GB_7D_HR_V2" where HR is country
              const countryMatch = esim.item.match(/_([A-Z]{2})_/);
              if (countryMatch) {
                countriesSet.add(countryMatch[1]);
              }
            }
          }
        }
      } catch (apiError) {
        console.error(`Error fetching data for eSIM ${esim.iccid}:`, apiError.message);
        // Continue with other eSIMs even if one fails
      }
    }

    // 4. Build response object
    const response = {
      user_details: {
        full_name: user.name || username,
        country: "Unknown", // You might want to add country field to User model
        profile_picture_url: user.profile_picture,
        active_esims: allEsims.length,
        data_used: totalDataUsed, // in bytes
        countries: countriesSet.size
      },
      esim_summary: latestEsimData || {
        plan_name: "",
        iccid: "",
        data: "",
        is_unlimited: false
      },
      data_usage: latestDataUsage || {
        data_used: "",
        data_remaining: "",
        data_total: ""
      }
    };

    return res.json({success: true, response});

  } catch (error) {
    console.error('Error fetching user summary:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// 1) Get My Profile
const getProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 2) Update Profile (name, email)
const updateProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const updates = (({ name, email }) => ({ name, email }))(req.body);

    const user = await User.findOneAndUpdate(
      { username },
      { $set: updates },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 3) Change Profile Picture
const changeProfilePicture = async (req, res) => {
  try {
    const { username } = req.params;
    const { profile_picture } = req.body;

    const user = await User.findOneAndUpdate(
      { username },
      { profile_picture },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile picture updated", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 4) Add Address
const addAddress = async (req, res) => {
  try {
    const { username } = req.params;
    const { address } = req.body;

    const user = await User.findOneAndUpdate(
      { username },
      { $push: { addresses: address } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Address added", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 5) Add Card
const addCard = async (req, res) => {
  try {
    const { username } = req.params;
    const { card_number, expiry, holder_name } = req.body;

    const user = await User.findOneAndUpdate(
      { username },
      {
        $push: {
          saved_cards: { card_number, expiry, holder_name },
        },
      },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Card added", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 6) Add Wallet Balance
const addWalletBalance = async (req, res) => {
  try {
    const { username } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findOneAndUpdate(
      { username },
      { $inc: { wallet_balance: amount } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Wallet balance updated", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { username } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check old password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

    // Just assign new password (don't hash here if pre-save hook exists)
    user.password = newPassword;

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// 📦 Fetch all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude passwords for security

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: "Server error while fetching users",
      error: error.message,
    });
  }
};

// Profile
// User routes
router.get("/", getAllUsers);  
router.get("/:username", getProfile);
router.put("/:username", updateProfile);
router.put("/:username/profile-picture", changeProfilePicture);

// Address & Cards
router.post("/:username/address", addAddress);
router.post("/:username/card", addCard);
router.put("/:username/password", updatePassword);
// Wallet
router.put("/:username/wallet", addWalletBalance);

module.exports = router;
module.exports = router;