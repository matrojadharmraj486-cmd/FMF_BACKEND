import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";
import { errorResponse } from "../utils/response.js";

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return errorResponse(res, 401, "Token missing");

  const decoded = verifyToken(token);
  const user = await User.findById(decoded.userId);

  if (!user) return errorResponse(res, 401, "Invalid token");

  req.user = user;
  next();
};


