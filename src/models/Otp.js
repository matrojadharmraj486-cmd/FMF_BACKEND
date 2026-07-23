import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  identifier: String, // email or mobile
  otp: String,
  expiresAt: Date
}, { timestamps: true });

// Auto-delete OTP records once they expire instead of leaving them to pile up.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);