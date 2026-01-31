import Otp from "../models/Otp.js";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";

const FIXED_OTP = "123456";

export const sendOtp = async (req, res) => {
  const { email, mobileNumber } = req.body;
  const identifier = email || mobileNumber;

  if (!identifier)
    return errorResponse(res, 400, "Email or mobile required");

  const user = await User.findOne({
    $or: [{ email: identifier }, { mobileNumber: identifier }]
  });

  await Otp.deleteMany({ identifier });

  await Otp.create({
    identifier,
    otp: FIXED_OTP,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  return successResponse(res, 200, "OTP sent successfully", {
    identifier,
    isUserExist: !!user,
    sentOn: email ? "EMAIL" : "MOBILE"
  });
};

export const verifyOtp = async (req, res) => {
  const { identifier, otp } = req.body;

  const otpDoc = await Otp.findOne({ identifier, otp });

  if (!otpDoc)
    return errorResponse(res, 400, "Invalid OTP");

  if (otpDoc.expiresAt < new Date())
    return errorResponse(res, 400, "OTP expired");

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
