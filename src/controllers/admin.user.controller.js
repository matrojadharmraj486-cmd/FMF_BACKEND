import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidMobile = (value) => /^\d{10}$/.test(String(value || "").trim());

export const listUsers = async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        fullName: 1,
        email: 1,
        mobileNumber: 1,
        isSubscribed: 1,
        role: 1,
        isActive: 1,
        isVerified: 1,
        isDeleted: 1,
        createdAt: 1
      }
    )
      .sort({ createdAt: -1 });
    return successResponse(res, 200, "Users fetched", users);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select(
      "fullName gender email mobileNumber age role isSubscribed subscription state district profileImg isVerified isActive isDeleted createdAt updatedAt"
    );
    if (!user) return errorResponse(res, 404, "User not found");
    return successResponse(res, 200, "User fetched", user);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "fullName")) {
      payload.fullName = String(req.body.fullName || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "gender")) {
      payload.gender = String(req.body.gender || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "age")) {
      const n = Number(req.body.age);
      if (!Number.isFinite(n) || n < 0) return errorResponse(res, 400, "age must be a valid number");
      payload.age = n;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (email && !isValidEmail(email)) return errorResponse(res, 400, "Invalid email address");
      payload.email = email;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "mobileNumber")) {
      const mobileNumber = String(req.body.mobileNumber || "").trim();
      if (mobileNumber && !isValidMobile(mobileNumber)) return errorResponse(res, 400, "Invalid mobile number");
      payload.mobileNumber = mobileNumber;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
      payload.role = String(req.body.role || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      payload.isActive = Boolean(req.body.isActive);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isVerified")) {
      payload.isVerified = Boolean(req.body.isVerified);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isDeleted")) {
      payload.isDeleted = Boolean(req.body.isDeleted);
    }

    const user = await User.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    }).select("fullName email mobileNumber isSubscribed role isActive isVerified isDeleted createdAt updatedAt");

    if (!user) return errorResponse(res, 404, "User not found");
    return successResponse(res, 200, "User updated", user);
  } catch (e) {
    if (e?.code === 11000) {
      const keys = Object.keys(e.keyPattern || e.keyValue || {});
      const field = keys[0] || "field";
      return errorResponse(res, 409, `${field} already exists`);
    }
    return errorResponse(res, 500, e.message);
  }
};

export const deleteUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user?._id) === String(id)) {
      return errorResponse(res, 400, "You cannot delete your own admin account");
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isDeleted: true, isActive: false },
      { new: true }
    ).select("fullName email mobileNumber isDeleted isActive updatedAt");

    if (!user) return errorResponse(res, 404, "User not found");
    return successResponse(res, 200, "User deleted", user);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { isSubscribed } = req.body || {};
    if (typeof isSubscribed !== "boolean")
      return errorResponse(res, 400, "isSubscribed boolean required");
    const user = await User.findByIdAndUpdate(id, { isSubscribed }, { new: true });
    if (!user) return errorResponse(res, 404, "User not found");
    return successResponse(res, 200, "Subscription updated", { id: user._id, isSubscribed: user.isSubscribed });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
