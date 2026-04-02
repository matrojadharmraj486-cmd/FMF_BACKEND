import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";
import { errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      logger.warn("Authentication failed: token missing", {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
      });
      return errorResponse(res, 401, "Token missing");
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      logger.warn("Authentication failed: user not found for token", {
        method: req.method,
        path: req.originalUrl,
        userId: decoded?.userId
      });
      return errorResponse(res, 401, "Invalid token");
    }

    req.user = user;
    next();
  } catch (e) {
    logger.error("Authentication middleware error", {
      method: req.method,
      path: req.originalUrl,
      error: e.message,
      stack: e.stack
    });
    return errorResponse(res, 401, "Invalid token");
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return next();
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (user) req.user = user;
    return next();
  } catch (e) {
    return next();
  }
};


