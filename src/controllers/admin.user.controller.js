import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import mongoose from "mongoose";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidMobile = (value) => /^\d{10}$/.test(String(value || "").trim());
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const ALLOWED_LIMITS = new Set([10, 20, 50, 100]);
const parsePositiveInt = (value) => {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  return i > 0 ? i : undefined;
};

const getSubscriptionInfo = (user) => {
  const source = user?.toObject ? user.toObject() : { ...(user || {}) };
  const endDate = source.subscription?.endDate ? new Date(source.subscription.endDate) : null;
  const isActive =
    source.subscription?.status === "active" &&
    endDate instanceof Date &&
    !Number.isNaN(endDate.getTime()) &&
    endDate > new Date();
  const remainingDays = isActive
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const subscriptionEndDate = isActive ? endDate.toISOString() : null;

  return {
    subscriptionStatus: isActive ? "active" : "inactive",
    remainingDays,
    subscriptionEndDate,
    isSubscribed: isActive,
    subscription: {
      ...(source.subscription && typeof source.subscription === "object" ? source.subscription : {}),
      status: isActive ? "active" : "inactive",
      isActive,
      remainingDays,
      endDate: subscriptionEndDate,
      expiresAt: subscriptionEndDate
    }
  };
};

const mapAdminUser = (user) => {
  const obj = user?.toObject ? user.toObject() : { ...(user || {}) };
  return {
    ...obj,
    ...getSubscriptionInfo(obj),
    isVerified: Boolean(obj.isVerified),
    blocked: obj.isActive === false
  };
};

const normalizeAddressPayload = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const pick = (k) => (hasOwn(raw, k) ? String(raw[k] || "").trim() : undefined);
  const addressLine1 = pick("addressLine1");
  const addressLine2 = pick("addressLine2");
  const city = pick("city");
  const state = pick("state");
  const country = pick("country");
  const pincode = pick("pincode");

  const anyProvided =
    addressLine1 !== undefined ||
    addressLine2 !== undefined ||
    city !== undefined ||
    state !== undefined ||
    country !== undefined ||
    pincode !== undefined;

  if (!anyProvided) return null;
  return { addressLine1, addressLine2, city, state, country, pincode };
};

export const listUsers = async (req, res) => {
  try {
    const { q, page, limit } = req.query || {};
    const wantsPagination = page !== undefined || limit !== undefined || q !== undefined;
    const parsedPage = parsePositiveInt(page) || 1;
    const parsedLimitRaw = parsePositiveInt(limit);
    let parsedLimit = wantsPagination ? 20 : undefined;
    if (parsedLimitRaw !== undefined) {
      if (parsedLimitRaw > 100) parsedLimit = 100;
      else if (ALLOWED_LIMITS.has(parsedLimitRaw)) parsedLimit = parsedLimitRaw;
    }

    const filter = { isDeleted: { $ne: true } };
    const term = String(q || "").trim();
    if (term) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [{ fullName: regex }, { email: regex }, { mobileNumber: regex }];
    }

    if (!wantsPagination) {
      const users = await User.find(
        filter,
        {
          fullName: 1,
          email: 1,
          mobileNumber: 1,
          subscription: 1,
          isVerified: 1,
          isActive: 1,
          createdAt: 1
        }
      ).sort({ createdAt: -1 });

      const data = users.map(mapAdminUser);

      return successResponse(res, 200, "Users fetched", data);
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [users, total] = await Promise.all([
      User.find(
        filter,
        {
          fullName: 1,
          email: 1,
          mobileNumber: 1,
          subscription: 1,
          isVerified: 1,
          isActive: 1,
          createdAt: 1
        }
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      User.countDocuments(filter)
    ]);

    const data = users.map(mapAdminUser);

    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));
    return successResponse(res, 200, "Users fetched", {
      data,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, "Invalid user id");
    const user = await User.findById(id);
    if (!user) return errorResponse(res, 404, "User not found");
    return successResponse(res, 200, "User fetched", mapAdminUser(user));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, "Invalid user id");
    const payload = {};

    if (hasOwn(req.body, "fullName")) {
      payload.fullName = String(req.body.fullName || "").trim();
    }
    if (hasOwn(req.body, "email")) {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (email && !isValidEmail(email)) return errorResponse(res, 400, "Invalid email address");
      payload.email = email;
    }
    if (hasOwn(req.body, "mobileNumber")) {
      const mobileNumber = String(req.body.mobileNumber || "").trim();
      if (mobileNumber && !isValidMobile(mobileNumber)) return errorResponse(res, 400, "Invalid mobile number");
      payload.mobileNumber = mobileNumber;
    }
    if (hasOwn(req.body, "isVerified")) {
      payload.isVerified = Boolean(req.body.isVerified);
    }

    const addressPayload = normalizeAddressPayload(req.body?.address);
    if (addressPayload) {
      payload.address = addressPayload;
    }

    const user = await User.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });

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
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, "Invalid user id");
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

export const bulkDeleteUsersAdmin = async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) return errorResponse(res, 400, "ids must be a non-empty array");

    const uniqueIds = Array.from(new Set(ids.map((x) => String(x || "").trim()).filter(Boolean)));
    const invalid = uniqueIds.filter((x) => !mongoose.Types.ObjectId.isValid(x));
    if (invalid.length) return errorResponse(res, 400, "ids contains invalid ObjectIds");

    const selfId = String(req.user?._id || "");
    const targetIds = uniqueIds.filter((x) => x !== selfId);
    if (targetIds.length === 0) return errorResponse(res, 400, "No valid user ids to delete");

    const existing = await User.find({ _id: { $in: targetIds } }, { _id: 1 });
    const existingIds = existing.map((u) => String(u._id));
    if (existingIds.length === 0) return successResponse(res, 200, "Users deleted", { deletedCount: 0, deletedIds: [] });

    const result = await User.updateMany(
      { _id: { $in: existingIds } },
      { $set: { isDeleted: true, isActive: false } }
    );

    const deletedCount = Number(result?.modifiedCount ?? result?.nModified ?? 0);
    return successResponse(res, 200, "Users deleted", { deletedCount, deletedIds: existingIds });
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
