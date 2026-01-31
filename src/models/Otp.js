import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  identifier: String, // email or mobile
  otp: String,
  expiresAt: Date
}, { timestamps: true });

export default mongoose.model("Otp", otpSchema);
