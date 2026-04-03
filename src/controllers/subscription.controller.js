import Subscription from "../models/Subscription.js";
import { successResponse, errorResponse } from "../utils/response.js";

const withPriceFormat = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const n = Number(obj.price);
  obj.price = Number.isFinite(n) ? n.toFixed(2) : obj.price;
  return obj;
};

export const listActiveSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.find({ isActive: true }).sort({ price: 1 });
    return successResponse(res, 200, "Subscriptions fetched", subs.map(withPriceFormat));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
