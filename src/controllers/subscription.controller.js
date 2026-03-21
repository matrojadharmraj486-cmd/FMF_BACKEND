import Subscription from "../models/Subscription.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const listActiveSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.find({ isActive: true }).sort({ price: 1 });
    return successResponse(res, 200, "Subscriptions fetched", subs);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
