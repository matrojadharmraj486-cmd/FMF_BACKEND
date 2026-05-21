import Subscription from "../models/Subscription.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import mongoose from "mongoose";

const ALLOWED_GST_PERCENTS = new Set([0, 5, 18]);

const parsePrice = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
};

const parseGstPercent = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (!ALLOWED_GST_PERCENTS.has(n)) return null;
  return n;
};

const withPriceFormat = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const n = Number(obj.price);
  obj.price = Number.isFinite(n) ? n.toFixed(2) : obj.price;

  const gstPercent = Number(obj.gstPercent);
  const gst = Number.isFinite(gstPercent) ? gstPercent : 0;
  obj.gstPercent = gst;
  const base = Number(n);
  if (Number.isFinite(base)) {
    const gstAmount = Math.round((base * gst / 100) * 100) / 100;
    const total = Math.round((base + gstAmount) * 100) / 100;
    obj.gstAmount = gstAmount.toFixed(2);
    obj.totalPrice = total.toFixed(2);
  } else {
    obj.gstAmount = obj.gstAmount ?? "0.00";
    obj.totalPrice = obj.totalPrice ?? obj.price;
  }
  return obj;
};

export const createSubscription = async (req, res) => {
  try {
    const { name, description, price, gstPercent, durationDays, currency, isActive } = req.body || {};

    const parsedPrice = parsePrice(price);
    if (!name || parsedPrice === null || parsedPrice <= 0 || !durationDays || durationDays <= 0) {
      return errorResponse(res, 400, "name, price (>0), and durationDays (>0) are required");
    }

    const parsedGst = parseGstPercent(gstPercent);
    if (parsedGst === null) {
      return errorResponse(res, 400, "gstPercent must be one of 0, 5, 18");
    }

    const subscription = await Subscription.create({
      name,
      description,
      features: [],
      price: parsedPrice,
      gstPercent: parsedGst,
      currency: currency || "INR",
      durationDays,
      isActive: typeof isActive === "boolean" ? isActive : true,
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    return successResponse(res, 201, "Subscription created", withPriceFormat(subscription));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const listSubscriptions = async (req, res) => {
  try {
    const includeInactive = (req.query.includeInactive || "").toString().toLowerCase() === "true";
    const includeDeleted = (req.query.includeDeleted || "").toString().toLowerCase() === "true";
    const filter = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(includeDeleted ? {} : { isDeleted: { $ne: true } })
    };
    const subs = await Subscription.find(filter).sort({ createdAt: -1 });
    return successResponse(res, 200, "Subscriptions fetched", subs.map(withPriceFormat));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, "Invalid subscription id");
    const { name, description, price, gstPercent, durationDays, currency, isActive } = req.body || {};

    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) {
      const parsedPrice = parsePrice(price);
      if (parsedPrice === null || parsedPrice <= 0) {
        return errorResponse(res, 400, "price must be a number greater than 0");
      }
      update.price = parsedPrice;
    }
    if (gstPercent !== undefined) {
      const parsedGst = parseGstPercent(gstPercent);
      if (parsedGst === null) {
        return errorResponse(res, 400, "gstPercent must be one of 0, 5, 18");
      }
      update.gstPercent = parsedGst;
    }
    if (typeof durationDays === "number" && durationDays > 0) update.durationDays = durationDays;
    if (currency) update.currency = currency;
    if (typeof isActive === "boolean") update.isActive = isActive;
    update.updatedBy = req.user?._id;

    const subscription = await Subscription.findByIdAndUpdate(id, update, { new: true });
    if (!subscription) return errorResponse(res, 404, "Subscription not found");
    return successResponse(res, 200, "Subscription updated", withPriceFormat(subscription));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSubscriptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, "Invalid subscription id");
    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive boolean required");
    }
    const subscription = await Subscription.findByIdAndUpdate(
      id,
      { isActive, updatedBy: req.user?._id },
      { new: true }
    );
    if (!subscription) return errorResponse(res, 404, "Subscription not found");
    return successResponse(res, 200, "Subscription status updated", withPriceFormat(subscription));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteSubscriptionAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, "Invalid subscription id");

    const subscription = await Subscription.findById(id);
    if (!subscription) return errorResponse(res, 404, "Subscription not found");

    const now = new Date();
    const [activeUsersCount, anyUserRefsCount, paymentsCount] = await Promise.all([
      User.countDocuments({
        "subscription.plan": subscription._id,
        "subscription.status": "active",
        "subscription.endDate": { $gt: now }
      }),
      User.countDocuments({ "subscription.plan": subscription._id }),
      Payment.countDocuments({ subscription: subscription._id })
    ]);

    const isReferenced = activeUsersCount > 0 || anyUserRefsCount > 0 || paymentsCount > 0;
    if (isReferenced) {
      subscription.isDeleted = true;
      subscription.isActive = false;
      subscription.updatedBy = req.user?._id;
      await subscription.save();

      return successResponse(res, 200, "Subscription deleted", {
        deleted: true,
        softDeleted: true,
        activeUsersCount,
        paymentsCount
      });
    }

    await Subscription.findByIdAndDelete(subscription._id);
    return successResponse(res, 200, "Subscription deleted", { deleted: true });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
