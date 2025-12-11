import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";

export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
console.log("otp", otp)
    const FIXED_OTP = "123456";

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required."
      });
    }

    if (otp !== FIXED_OTP) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP."
      });
    }

    // Read token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing."
      });
    }

    // Decode token
    const decoded = verifyToken(token);

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    // Update user verification status
    user.isVerified = true;
    await user.save();

    return res.json({
      success: true,
      message: "OTP verified successfully!",
      userId: user._id
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying OTP.",
      error: error.message
    });
  }
};
