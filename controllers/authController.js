const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client with detailed error handling
const initGoogleClient = () => {
  const clientId = "408751689194-g4u8vljikgc08dl532tap57q6j97asom.apps.googleusercontent.com";
  if (!clientId) {
    console.error('❌ GOOGLE_CLIENT_ID environment variable is not set!');
    return null;
  }
  console.log('✅ Google OAuth client initialized with client ID:', clientId.substring(0, 10) + '...');
  return new OAuth2Client(clientId);
};

const client = initGoogleClient();

// @desc    Register user
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, Email & Password are required" });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, username, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Google Sign-In
// @route   POST /api/auth/google
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    console.log('🔄 Received Google sign-in request');
    
    // Validate input
    if (!idToken) {
      console.log('❌ No ID token provided');
      return res.status(400).json({ message: "Google ID token is required" });
    }

    // Check if client is initialized
    if (!client) {
      console.error('❌ Google client not initialized - check GOOGLE_CLIENT_ID env var');
      return res.status(500).json({ message: "Google authentication not configured properly" });
    }

    console.log('✅ ID Token received (length:', idToken.length, ')');

    // Verify the Google ID token
    console.log('🔄 Verifying ID token with Google...');
    let ticket;
    
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      console.log('✅ Token verified successfully');
    } catch (verifyError) {
      console.error('❌ Token verification failed:', verifyError.message);
      
      // Handle specific verification errors
      if (verifyError.message.includes('Wrong recipient')) {
        return res.status(400).json({ 
          message: "Invalid client configuration", 
          debug: process.env.NODE_ENV === 'development' ? 'Client ID mismatch' : undefined
        });
      }
      
      if (verifyError.message.includes('Token used too late')) {
        return res.status(400).json({ message: "Google token has expired. Please try again." });
      }
      
      if (verifyError.message.includes('Invalid token')) {
        return res.status(400).json({ message: "Invalid Google token. Please try again." });
      }
      
      return res.status(400).json({ 
        message: "Token verification failed", 
        debug: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
      });
    }

    const payload = ticket.getPayload();
    
    // Extract user information
    const googleId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'];
    const picture = payload['picture'];
    const emailVerified = payload['email_verified'];

    console.log('📧 User email:', email);
    console.log('👤 User name:', name);
    console.log('✅ Email verified:', emailVerified);

    // Check email verification
    if (!emailVerified) {
      console.log('❌ Email not verified by Google');
      return res.status(400).json({ message: "Please verify your email with Google first" });
    }

    // Check if user exists with this email
    console.log('🔍 Checking if user exists...');
    let user = await User.findOne({ email: email });
    let isNewUser = false;

    if (user) {
      console.log('✅ Existing user found');
      
      // Update Google ID and profile picture if not set
      let userUpdated = false;
      if (!user.googleId) {
        user.googleId = googleId;
        userUpdated = true;
      }
      if (!user.profile_picture && picture) {
        user.profile_picture = picture;
        userUpdated = true;
      }
      
      if (userUpdated) {
        await user.save();
        console.log('✅ Updated existing user with Google info');
      }

      // Return existing user
      return res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profile_picture: user.profile_picture,
        token: generateToken(user._id),
        isNewUser: false,
      });
    }

    console.log('🔄 Creating new user...');
    isNewUser = true;
    
    // Generate unique username from email
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let counter = 1;

    // Ensure username is unique
    while (await User.findOne({ username: username })) {
      username = `${baseUsername}${counter}`;
      counter++;
      
      // Prevent infinite loop
      if (counter > 1000) {
        username = `${baseUsername}_${Date.now()}`;
        break;
      }
    }

    console.log('📝 Generated username:', username);

    // Create new user with Google data
    user = await User.create({
      name: name || email.split('@')[0], // Fallback to email prefix if no name
      username: username,
      email: email,
      googleId: googleId,
      profile_picture: picture,
      password: generateRandomPassword(),
      isGoogleUser: true,
      emailVerified: true, // Google users are pre-verified
    });

    console.log('✅ New user created successfully');

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      profile_picture: user.profile_picture,
      token: generateToken(user._id),
      isNewUser: true,
    });

  } catch (error) {
    console.error('❌ Google Sign-In Error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: "Invalid user data", 
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ message: "User with this email already exists" });
    }
    
    if (error.message.includes('E11000')) {
      // MongoDB duplicate key error
      return res.status(400).json({ message: "Username or email already taken" });
    }
    
    // Database connection errors
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(500).json({ message: "Database connection error. Please try again." });
    }
    
    // Generic server error
    res.status(500).json({ 
      message: "Google Sign-In failed due to server error", 
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get logged-in user profile
// @route   GET /api/auth/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Logout user (mainly for clearing any server-side sessions if implemented)
// @route   POST /api/auth/logout
exports.logoutUser = async (req, res) => {
  try {
    // If you're using sessions, clear them here
    // For JWT-based auth, the client just needs to remove the token
    
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error('❌ Logout error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Helper function to generate random password for Google users
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) { // Increased length for better security
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Helper function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export helper functions for testing
exports.generateRandomPassword = generateRandomPassword;
exports.isValidEmail = isValidEmail;