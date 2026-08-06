import jwt from "jsonwebtoken";

// `sessionId` ties the token to one device (see utils/session.js). It is left
// off admin tokens, which are exempt from the single-device rule.
export const generateToken = (userId, sessionId) => {
  const payload = { userId };
  if (sessionId) payload.sid = sessionId;
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
