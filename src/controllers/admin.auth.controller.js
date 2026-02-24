import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { generateToken } from "../utils/jwt.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@fmf.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

export const adminLogin = async (req, res) => {
  const { email, password } = req.body || {};
  console.log("request Body", req?.body)
  if (!email || !password)
    return errorResponse(res, 400, "email and password are required");

  if (email !== ADMIN_EMAIL)
    return errorResponse(res, 403, "Admin email not allowed");

  if (password !== ADMIN_PASSWORD)
    return errorResponse(res, 401, "Invalid credentials");

  let user = await User.findOne({ email });
  console.log("user1", user)
  if (!user) {
    user = await User.create({
      fullName: ADMIN_NAME,
      email,
      role: "Admin",
      password: ADMIN_PASSWORD,
      isVerified: true
    });
      console.log("user2", user)
  } else if ((user.role || "").toLowerCase() !== "admin") {
    user.role = "Admin";
    await user.save();
  }

  const token = generateToken(user._id);

  return successResponse(res, 200, "Admin login successful", {
    token,
    user: {
      id: user._id,
      name: user.fullName,
      email: user.email,
      role: "admin"
    }
  });
};

