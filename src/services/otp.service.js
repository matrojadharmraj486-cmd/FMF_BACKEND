const crypto = require('crypto');

const otpStore = new Map(); // In-memory store (use Redis or DB in production)

const generateOtp = async (identifier) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  otpStore.set(identifier, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 mins expiry
  console.log(`OTP for ${identifier}: ${otp}`);
  return otp;
};

const verifyOtp = async (identifier, otp) => {
  const record = otpStore.get(identifier);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    otpStore.delete(identifier);
    return false;
  }
  const isValid = record.otp === otp;
  if (isValid) otpStore.delete(identifier);
  return isValid;
};

module.exports = { generateOtp, verifyOtp };
