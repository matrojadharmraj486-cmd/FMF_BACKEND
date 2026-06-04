import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { sendBrevoEmail } from "../utils/email.js";
import { buildWelcomeEmail } from "../utils/emailTemplates.js";
import { logger } from "../utils/logger.js";

export const register = async (req, res) => {
  const { email, mobileNumber } = req.body;

  const existingUser = await User.findOne({
    $or: [
      { email },
      { mobileNumber }
    ]
  });

  if (existingUser) {
    return errorResponse(res, 400, "User already exists with this email or mobile number");
  }

  const user = await User.create({
    ...req.body,
    isVerified: true
  });

  const token = generateToken(user._id);

  if (user.email) {
    try {
      const tpl = buildWelcomeEmail({ userName: user.fullName || "User" });
      await sendBrevoEmail({
        to: user.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html
      });
      logger.info("Welcome email sent", {
        userId: user._id,
        email: user.email
      });
    } catch (err) {
      logger.error("Welcome email failed", {
        userId: user._id,
        email: user.email,
        error: err.message,
        stack: err.stack
      });
    }
  }

  return successResponse(res, 201, "Registration successful", {
    user,
    token
  });
};


export const login = async (req, res) => {
  const { identifier, password, isVerified } = req.body;

  const user = await User.findOne({
    $or: [
      { email: identifier },
      { mobileNumber: identifier }
    ]
  }).select("+password");

  if (!user)
    return errorResponse(res, 404, "User not found");

  const isMobile = /^\d{10}$/.test(identifier);

  // 📱 MOBILE LOGIN (OTP verified)
  if (isMobile) {
    if (!isVerified)
      return errorResponse(res, 400, "OTP verification required");

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return successResponse(res, 200, "Login successful (Mobile)", {
      user,
      token
    });
  }

  // 📧 EMAIL LOGIN (Password required)
  if (!password)
    return errorResponse(res, 400, "Password is required for email login");

  const isMatch = await user.comparePassword(password);
  if (!isMatch)
    return errorResponse(res, 400, "Invalid password");

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);

  return successResponse(res, 200, "Login successful (Email)", {
    user,
    token
  });
};
