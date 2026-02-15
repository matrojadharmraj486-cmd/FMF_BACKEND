import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const updateProfile = async (req, res) => {

  try {

    const user = await User.findById(req.user._id);

    if (!user)
      return errorResponse(res, 404, "User not found");

    user.fullName = req.body.fullName || user.fullName;
    user.city = req.body.city || user.city;

    if (req.file) {
      user.profileImg = `/uploads/${req.file.filename}`;
    }

    await user.save();

    return successResponse(res, 200, "Profile updated", user);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }

};
