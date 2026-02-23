import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";
import { errorResponse } from "../utils/response.js";

export const adminAuthenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return errorResponse(res, 401, "Token missing");
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) return errorResponse(res, 401, "Invalid token");
    if (user.role?.toLowerCase() !== "admin")
      return errorResponse(res, 403, "Admin access required");
    req.user = user;
    next();
  } catch (e) {
    return errorResponse(res, 401, "Invalid token");
  }
};

