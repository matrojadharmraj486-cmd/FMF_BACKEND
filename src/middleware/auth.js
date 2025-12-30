import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js"; 

export const authenticate = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Token missing."
      });
    }

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token."
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "OTP verification required."
      });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired."
    });
  }
};
