import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { successResponse } from "../utils/response.js";

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user)
    return errorResponse(res, 404, "User not found");

  const otp = "123456";

  await Otp.create({
    identifier: email,
    otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  return successResponse(res, 200, "OTP sent to email", {
  email,
  expiresIn: "5 minutes"
});
};
