import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getFirebaseAdmin } from "../utils/firebase.js";
import { logger } from "../utils/logger.js";

// Firebase reports the provider that actually signed the user in. Anything
// outside this list (password, phone, facebook...) is rejected on purpose.
const PROVIDER_LABELS = {
  "google.com": "Google",
  "apple.com": "Apple"
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const emailMatch = (email) => ({
  email: { $regex: `^${escapeRegex(email)}$`, $options: "i" }
});

const buildAuthPayload = (user, extras = {}) => {
  const missingFields = user.getMissingProfileFields();
  return {
    user,
    token: generateToken(user._id),
    isProfileComplete: missingFields.length === 0,
    missingFields,
    ...extras
  };
};

export const socialLogin = async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || req.body?.token || "").trim();
    if (!idToken) return errorResponse(res, 400, "idToken is required");

    let admin;
    try {
      admin = await getFirebaseAdmin();
    } catch (e) {
      logger.error("Social login unavailable: Firebase not configured", {
        code: e.code,
        error: e.message
      });
      return errorResponse(res, 503, "Social login is not configured on the server");
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      logger.warn("Social login rejected: token verification failed", {
        code: e.code,
        error: e.message
      });
      return errorResponse(res, 401, "Invalid or expired social login token");
    }

    const provider = String(decoded.firebase?.sign_in_provider || "").toLowerCase();
    const providerLabel = PROVIDER_LABELS[provider];
    if (!providerLabel) {
      return errorResponse(res, 400, "Only Google and Apple sign-in are supported");
    }

    const firebaseUid = String(decoded.uid || "").trim();
    if (!firebaseUid) return errorResponse(res, 401, "Invalid social login token");

    // Apple only returns email/name on the very first sign-in, and hidden-email
    // users arrive as ...@privaterelay.appleid.com, which is a normal address here.
    const email = normalizeEmail(decoded.email);
    const name = String(decoded.name || "").trim();
    const picture = String(decoded.picture || "").trim();

    let user = await User.findOne({ firebaseUid });
    let isNewUser = false;
    let linkedExistingAccount = false;

    // Same person returning through a different door: match on the verified
    // email and attach the provider to the account they already own.
    if (!user && email) {
      user = await User.findOne(emailMatch(email));
      linkedExistingAccount = Boolean(user);
    }

    if (user) {
      if (user.isDeleted) {
        return errorResponse(res, 403, "This account has been deleted. Please contact support.");
      }
      if (user.isActive === false) {
        return errorResponse(res, 403, "This account has been blocked. Please contact support.");
      }

      user.firebaseUid = firebaseUid;
      user.authProvider = provider;
      user.isVerified = true;
      if (name && !user.fullName) user.fullName = name;
      if (picture && !user.profileImg) user.profileImg = picture;
      user.lastLogin = new Date();
      await user.save();
    } else {
      isNewUser = true;
      const payload = {
        fullName: name || (email ? email.split("@")[0] : "User"),
        isVerified: true,
        isActive: true,
        isDeleted: false,
        firebaseUid,
        authProvider: provider,
        lastLogin: new Date()
      };
      // email/mobileNumber are left unset rather than "" so the sparse unique
      // indexes keep ignoring accounts that genuinely have no value.
      if (email) payload.email = email;
      if (picture) payload.profileImg = picture;

      try {
        user = await User.create(payload);
      } catch (e) {
        if (e?.code !== 11000) throw e;
        // Parallel first-time sign-ins from the same device: whoever lost the
        // race just reads back the row the winner created.
        user = await User.findOne({ firebaseUid });
        if (!user) {
          return errorResponse(res, 409, "Could not complete social login. Please try again.");
        }
        isNewUser = false;
      }
    }

    logger.info("Social login successful", {
      userId: user._id,
      provider,
      isNewUser,
      linkedExistingAccount
    });

    return successResponse(res, 200, `Login successful (${providerLabel})`, buildAuthPayload(user, {
      isNewUser,
      authProvider: provider
    }));
  } catch (e) {
    logger.error("Social login failed", {
      error: e.message,
      stack: e.stack
    });
    return errorResponse(res, 500, e.message);
  }
};
