import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const register = async (req, res) => {
  const user = await User.create({
    ...req.body,
    isVerified: true
  });

  const token = generateToken(user._id);

  return successResponse(res, 201, "Registration successful", {
    user,
    token
  });
};

export const login = async (req, res) => {
  const { identifier, password } = req.body;

  const user = await User.findOne({
    $or: [{ email: identifier }, { mobileNumber: identifier }]
  }).select("+password");

  if (!user)
    return errorResponse(res, 404, "User not found");

  const isMatch = await user.comparePassword(password);
  if (!isMatch)
    return errorResponse(res, 400, "Invalid password");

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);

  return successResponse(res, 200, "Login successful", {
    user,
    token
  });
};
