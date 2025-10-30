const express = require("express");
const { registerUser, loginUser, getProfile, googleSignIn } = require("../controllers/authController");
const {protect} = require("../middleware/authMiddleware");

const router = express.Router();

// Regular auth routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.get("/me", protect, getProfile);
// Google OAuth route
router.post("/google", googleSignIn);

module.exports = router;