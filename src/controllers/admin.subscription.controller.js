import Subscription from "../models/Subscription.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const createSubscription = async (req, res) => {
  try {
    const { name, description, features, price, durationDays, currency, isActive } = req.body || {};

    if (!name || typeof price !== "number" || price <= 0 || !durationDays || durationDays <= 0) {
      return errorResponse(res, 400, "name, price (>0), and durationDays (>0) are required");
    }

    const subscription = await Subscription.create({
      name,
      description,
      features: Array.isArray(features) ? features : [],
      price,
      currency: currency || "INR",
      durationDays,
      isActive: typeof isActive === "boolean" ? isActive : true,
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    return successResponse(res, 201, "Subscription created", subscription);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const listSubscriptions = async (req, res) => {
  try {
    const includeInactive = (req.query.includeInactive || "").toString().toLowerCase() === "true";
    const filter = includeInactive ? {} : { isActive: true };
    const subs = await Subscription.find(filter).sort({ createdAt: -1 });
    return successResponse(res, 200, "Subscriptions fetched", subs);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, features, price, durationDays, currency, isActive } = req.body || {};

    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (Array.isArray(features)) update.features = features;
    if (typeof price === "number" && price > 0) update.price = price;
    if (typeof durationDays === "number" && durationDays > 0) update.durationDays = durationDays;
    if (currency) update.currency = currency;
    if (typeof isActive === "boolean") update.isActive = isActive;
    update.updatedBy = req.user?._id;

    const subscription = await Subscription.findByIdAndUpdate(id, update, { new: true });
    if (!subscription) return errorResponse(res, 404, "Subscription not found");
    return successResponse(res, 200, "Subscription updated", subscription);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSubscriptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
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
    return successResponse(res, 200, "Subscription status updated", subscription);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
