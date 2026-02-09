
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";


export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      req.body,
      { new: true }
    );

    if (!updatedUser)
      return errorResponse(res, 404, "User not found");

    return successResponse(
      res,
      200,
      "Profile updated successfully",
      updatedUser
    );

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};