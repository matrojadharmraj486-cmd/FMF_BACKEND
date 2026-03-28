import crypto from "crypto";

const DEFAULT_LENGTH = 6;

export const generateOtp = (length = DEFAULT_LENGTH) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(crypto.randomInt(min, max + 1));
};

export const hashOtp = (otp, identifier) => {
  const secret = process.env.OTP_HASH_SECRET || "fmf-otp-secret";
  return crypto
    .createHash("sha256")
    .update(`${otp}:${identifier}:${secret}`)
    .digest("hex");
};

export const getOtpExpiry = () => {
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 5);
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
};

export const formatOtpMessage = (otp, minutes) => {
  return `Your OTP FMF application ${otp}. It expires in ${minutes} minutes.`;
};
