import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const updateProfile = async (req, res) => {

  try {

    const user = await User.findById(req.user._id);

    if (!user)
      return errorResponse(res, 404, "User not found");

    const {
      fullName,
      email,
      mobileNumber,
      gender,
      age,
      state,
      district,
      city
    } = req.body || {};

    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: user._id } });
      if (exists) return errorResponse(res, 400, "Email already in use");
      user.email = email;
    }

    if (mobileNumber && mobileNumber !== user.mobileNumber) {
      const exists = await User.findOne({ mobileNumber, _id: { $ne: user._id } });
      if (exists) return errorResponse(res, 400, "Mobile number already in use");
      user.mobileNumber = mobileNumber;
    }

    user.fullName = fullName || user.fullName;
    user.gender = gender || user.gender;
    user.age = age ?? user.age;
    user.state = state || user.state;
    user.district = district || user.district;
    user.city = city || user.city;

    if (req.file) {
      user.profileImg = `/uploads/${req.file.filename}`;
    }

    await user.save();

    return successResponse(res, 200, "Profile updated", user);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }

};
