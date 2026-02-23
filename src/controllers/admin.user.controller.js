import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const listUsers = async (req, res) => {
  try {
    const users = await User.find({}, { fullName: 1, email: 1, mobileNumber: 1, isSubscribed: 1, role: 1, isActive: 1 })
      .sort({ createdAt: -1 });
    return successResponse(res, 200, "Users fetched", users);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { isSubscribed } = req.body;
    if (typeof isSubscribed !== "boolean")
      return errorResponse(res, 400, "isSubscribed boolean required");
    const user = await User.findByIdAndUpdate(id, { isSubscribed }, { new: true });
    if (!user) return errorResponse(res, 404, "User not found");
    return successResponse(res, 200, "Subscription updated", { id: user._id, isSubscribed: user.isSubscribed });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

