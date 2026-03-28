import Otp from "../models/Otp.js";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { sendBulk9Email, sendBulk9Sms } from "../utils/bulk9.js";
import { generateOtp, getOtpExpiry, hashOtp, formatOtpMessage } from "../utils/otp.js";
import { sendSmtpEmail } from "../utils/email.js";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
const isMobile = (value) => /^\d{10}$/.test(value || "");

export const sendOtp = async (req, res) => {
  const { email, mobileNumber } = req.body;
  const identifier = email || mobileNumber;

  if (!identifier)
    return errorResponse(res, 400, "Email or mobile required");

  if (email && !isEmail(email))
    return errorResponse(res, 400, "Invalid email address");

  if (mobileNumber && !isMobile(mobileNumber))
    return errorResponse(res, 400, "Invalid mobile number");

  const user = await User.findOne({
    $or: [{ email: identifier }, { mobileNumber: identifier }]
  });

  await Otp.deleteMany({ identifier });

  const otp = generateOtp();
  const expiresAt = getOtpExpiry();
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 5);
  const message = formatOtpMessage(otp, ttlMinutes);

  await Otp.create({
    identifier,
    otp: hashOtp(otp, identifier),
    expiresAt
  });

  try {
    if (email) {
      const subject = process.env.BULK9_EMAIL_SUBJECT || "Your OTP";
      if (process.env.BULK9_EMAIL_URL) {
        const response = await sendBulk9Email({
          to: email,
          subject,
          message,
          otp
        });

        if (!response.ok)
          return errorResponse(res, 502, "Failed to send OTP email");
      } else {
        await sendSmtpEmail({
          to: email,
          subject,
          text: message
        });
      }
    } else {
      const response = await sendBulk9Sms({
        to: mobileNumber,
        message,
        otp
      });

      console.log("Bulk9 SMS response", response);

      if (!response.ok)
        return errorResponse(res, 502, "Failed to send OTP SMS");
    }
  } catch (err) {
    return errorResponse(res, 502, err.message || "Failed to send OTP");
  }

  return successResponse(res, 200, "OTP sent successfully", {
    identifier,
    isUserExist: !!user,
    sentOn: email ? "EMAIL" : "MOBILE"
  });
};

export const verifyOtp = async (req, res) => {
  const { identifier, otp } = req.body;

  const otpDoc = await Otp.findOne({ identifier });

  if (!otpDoc)
    return errorResponse(res, 400, "Invalid OTP");

  if (otpDoc.expiresAt < new Date())
    return errorResponse(res, 400, "OTP expired");

  const hashed = hashOtp(otp, identifier);
  if (hashed !== otpDoc.otp)
    return errorResponse(res, 400, "Invalid OTP");

  await Otp.deleteOne({ _id: otpDoc._id });

  const user = await User.findOne({
    $or: [{ email: identifier }, { mobileNumber: identifier }]
  });

  return successResponse(res, 200, "OTP verified successfully", {
    identifier,
    isUserExist: !!user,
    nextStep: user ? "LOGIN" : "REGISTER"
  });
};
