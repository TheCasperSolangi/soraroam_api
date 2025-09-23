const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    wallet_balance: { type: Number, default: 0 },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    profile_picture: { type: String },
    addresses: [{ type: String }],
    saved_cards: [
      {
        card_number: Number,
        expiry: String,
        holder_name: String,
        cvv: Number
      },
    ],
    // Google OAuth fields
    googleId: { type: String, unique: true, sparse: true },
    isGoogleUser: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Encrypt password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);