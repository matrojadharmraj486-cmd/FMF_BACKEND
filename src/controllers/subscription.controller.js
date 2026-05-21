import Subscription from "../models/Subscription.js";
import { successResponse, errorResponse } from "../utils/response.js";

const withPriceFormat = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const n = Number(obj.price);
  obj.price = Number.isFinite(n) ? n.toFixed(2) : obj.price;

  const gstPercent = Number(obj.gstPercent);
  const gst = Number.isFinite(gstPercent) ? gstPercent : 0;
  obj.gstPercent = gst;
  if (Number.isFinite(n)) {
    const gstAmount = Math.round((n * gst / 100) * 100) / 100;
    const total = Math.round((n + gstAmount) * 100) / 100;
    obj.gstAmount = gstAmount.toFixed(2);
    obj.totalPrice = total.toFixed(2);
  } else {
    obj.gstAmount = obj.gstAmount ?? "0.00";
    obj.totalPrice = obj.totalPrice ?? obj.price;
  }
  return obj;
};

export const listActiveSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.find({ isActive: true, isDeleted: { $ne: true } }).sort({ price: 1 });
    return successResponse(res, 200, "Subscriptions fetched", subs.map(withPriceFormat));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
