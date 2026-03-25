import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";
import { errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const adminAuthenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    logger.warn("Admin authentication failed: token missing", {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip
    });
    return errorResponse(res, 401, "Token missing");
  }
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) {
      logger.warn("Admin authentication failed: user not found", {
        method: req.method,
        path: req.originalUrl,
        userId: decoded?.userId
      });
      return errorResponse(res, 401, "Invalid token");
    }
    if ((user.role || "").toLowerCase() !== "admin") {
      logger.warn("Admin authentication failed: non-admin user", {
        method: req.method,
        path: req.originalUrl,
        userId: user._id
      });
      return errorResponse(res, 403, "Admin access required");
    }
    req.user = user;
    next();
  } catch (e) {
    logger.error("Admin authentication middleware error", {
      method: req.method,
      path: req.originalUrl,
      error: e.message,
      stack: e.stack
    });
    return errorResponse(res, 401, "Invalid token");
  }
};

