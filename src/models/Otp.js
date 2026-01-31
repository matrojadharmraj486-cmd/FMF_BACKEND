import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: String,
  mobileNumber: String,
  otp: String,
  expiresAt: Date,
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Otp", otpSchema);
