import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { sendEmail } from "../utils/email.js";
import { buildWelcomeEmail } from "../utils/emailTemplates.js";
import { logger } from "../utils/logger.js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMobileNumber = (value) => String(value || "").trim();
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const activeUserFilter = { isDeleted: { $ne: true }, isActive: { $ne: false } };

const emailMatch = (email) => ({
  email: { $regex: `^${escapeRegex(email)}$`, $options: "i" }
});

export const register = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const mobileNumber = normalizeMobileNumber(req.body.mobileNumber);
    if (!email && !mobileNumber) {
      return errorResponse(res, 400, "Email or mobile number is required");
    }

    const existingUser = await User.findOne({
      ...activeUserFilter,
      $or: [
        ...(email ? [emailMatch(email)] : []),
        ...(mobileNumber ? [{ mobileNumber }] : [])
      ]
    });

    // A verified account blocks re-registration. Legacy rows that the older flow
    // left unverified are still reclaimed below so those users aren't stuck.
    // Mirrors the verify-otp payload so the client can route straight to the
    // right screen instead of leaving the user stranded on register.
    if (existingUser && existingUser.isVerified) {
      const isSocialAccount = Boolean(existingUser.firebaseUid);
      const message = isSocialAccount
        ? "This account already exists with social sign-in. Please continue with Google or Apple."
        : "User already exists with this email or mobile number";

      return errorResponse(res, 400, message, {
        identifier: email || mobileNumber,
        isUserExist: true,
        nextStep: isSocialAccount ? "SOCIAL_LOGIN" : "LOGIN",
        authProvider: existingUser.authProvider || null
      });
    }

    // Registration is only reachable after /auth/verify-otp succeeds, so the
    // account is verified from the moment it is created.
    let user;
    if (existingUser) {
      // Reclaim the abandoned registration with the latest submitted details.
      existingUser.set({
        ...req.body,
        email,
        mobileNumber,
        isVerified: true,
        isActive: true,
        isDeleted: false
      });
      user = await existingUser.save();
    } else {
      user = await User.create({
        ...req.body,
        email,
        mobileNumber,
        isVerified: true,
        isActive: true,
        isDeleted: false
      });
    }

    const token = generateToken(user._id);

    if (user.email) {
      try {
        const tpl = buildWelcomeEmail({ userName: user.fullName || "User" });
        await sendEmail({
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
  } catch (err) {
    if (err?.code === 11000) {
      return errorResponse(res, 409, "Email or mobile number already exists, possibly on a deleted account. Please contact support to restore or clean the old account.");
    }
    return errorResponse(res, 500, err.message);
  }
};

export const login = async (req, res) => {
  try {
    const { password, isVerified } = req.body;
    const rawIdentifier = String(req.body.identifier || "").trim();
    if (!rawIdentifier) {
      return errorResponse(res, 400, "identifier is required");
    }

    const isMobile = /^\d{10}$/.test(rawIdentifier);
    const identifier = isMobile ? rawIdentifier : normalizeEmail(rawIdentifier);

    const user = await User.findOne({
      ...activeUserFilter,
      $or: [
        ...(identifier ? [emailMatch(identifier), { mobileNumber: identifier }] : [])
      ]
    }).select("+password");

    if (!user)
      return errorResponse(res, 404, "User not found");

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

    // Google/Apple accounts never got a password, so send them back to the
    // button they actually signed up with instead of "Invalid password".
    if (!user.password) {
      return errorResponse(res, 400, "This account uses social sign-in. Please continue with Google or Apple.", {
        identifier,
        nextStep: "SOCIAL_LOGIN",
        authProvider: user.authProvider || null
      });
    }

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
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
