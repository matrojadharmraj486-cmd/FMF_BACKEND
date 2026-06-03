import fs from "fs";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { uploadImageData, uploadImageFile } from "../utils/cloudinary.js";

export const updateProfile = async (req, res) => {
console.log("update profile API BODY", req?.body)
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
      const uploaded = await uploadImageFile(req.file.path, "fmf/profiles");
      user.profileImg = uploaded.url;
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // ignore cleanup errors
      }
    } else if (req.body.photoBase64) {
      const raw = String(req.body.photoBase64 || "").trim();
      if (raw) {
        const dataUri = raw.startsWith("data:")
          ? raw
          : `data:image/jpeg;base64,${raw}`;
        const uploaded = await uploadImageData(dataUri, "fmf/profiles");
        user.profileImg = uploaded.url;
      }
    }

    await user.save();

    return successResponse(res, 200, "Profile updated", user);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }

};

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user)
      return errorResponse(res, 404, "User not found");

    const data = {
      ...user.toObject(),
      photoUrl: user.profileImg || null
    };
    return successResponse(res, 200, "Profile fetched", data);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, 404, "User not found");

    user.isDeleted = true;
    user.isActive = false;
    // Append timestamp to email/mobile to free them up for new registration if needed
    const timestamp = Date.now();
    if (user.email) user.email = `deleted_${timestamp}_${user.email}`;
    if (user.mobileNumber) user.mobileNumber = `deleted_${timestamp}_${user.mobileNumber}`;
    
    await user.save();

    return successResponse(res, 200, "Account deleted successfully");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
