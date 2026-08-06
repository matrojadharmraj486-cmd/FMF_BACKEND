import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";
import { errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import {
  isSessionValid,
  SESSION_REVOKED_CODE,
  SESSION_REVOKED_MESSAGE
} from "../utils/session.js";

const activeUserLookup = (userId) => ({
  _id: userId,
  isDeleted: { $ne: true },
  isActive: { $ne: false }
});

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
    const user = await User.findOne(activeUserLookup(decoded.userId));

    if (!user) {
      logger.warn("Authentication failed: user not found for token", {
        method: req.method,
        path: req.originalUrl,
        userId: decoded?.userId
      });
      return errorResponse(res, 401, "Invalid token");
    }

    // Someone signed into this account elsewhere, so this device's token is no
    // longer the active one.
    if (!isSessionValid(user, decoded)) {
      logger.warn("Authentication failed: session no longer active", {
        method: req.method,
        path: req.originalUrl,
        userId: user._id,
        hasTokenSession: Boolean(decoded?.sid)
      });
      return errorResponse(res, 401, SESSION_REVOKED_MESSAGE, {
        code: SESSION_REVOKED_CODE
      });
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
    const user = await User.findOne(activeUserLookup(decoded.userId));
    // A revoked session degrades to anonymous rather than erroring, so public
    // routes like /api/home keep working for a device that was signed out.
    if (user && isSessionValid(user, decoded)) req.user = user;
    return next();
  } catch (e) {
    return next();
  }
};
