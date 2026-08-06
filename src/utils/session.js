import crypto from "crypto";
import User from "../models/User.js";

// Returned to the client alongside the 401 so the app can tell "someone else
// signed in" apart from an ordinary expired token and show the right screen.
export const SESSION_REVOKED_CODE = "SESSION_REVOKED";
export const SESSION_REVOKED_MESSAGE =
  "You have been logged out because your account was signed in on another device.";

const isAdmin = (user) => String(user?.role || "").toLowerCase() === "admin";

const readDeviceId = (source) => String(source?.deviceId || source?.device_id || "").trim();

/**
 * Opens the one allowed session for an app account and returns the id to embed
 * in the JWT. Writing the new id is what invalidates the previous device's
 * token, so this must run on every login path.
 *
 * Passing the request body lets a device that already owns the session keep it
 * instead of rotating: without that, an app retrying a timed-out login would
 * invalidate the token its own first attempt just received.
 *
 * Admin accounts return `null` — their tokens carry no `sid` and stay valid
 * across browsers.
 */
export const startSession = async (user, source = {}) => {
  if (!user) return null;
  if (isAdmin(user)) return null;

  const deviceId = readDeviceId(source);
  if (deviceId && user.activeSessionId && user.activeDeviceId === deviceId) {
    return user.activeSessionId;
  }

  const sessionId = crypto.randomUUID();
  await User.updateOne(
    { _id: user._id },
    { $set: { activeSessionId: sessionId, activeDeviceId: deviceId } }
  );

  // Keep the in-memory doc in step; callers often save or serialize it after.
  user.activeSessionId = sessionId;
  user.activeDeviceId = deviceId;

  return sessionId;
};

/** Drops the session so the token is dead server-side, not just client-side. */
export const endSession = async (userId) => {
  await User.updateOne(
    { _id: userId },
    { $set: { activeSessionId: null, activeDeviceId: "" } }
  );
};

/**
 * A token is good only while its `sid` is still the account's active one.
 * Tokens minted before this feature carry no `sid`, so they fail here and
 * every user signs in once more — the intended one-time reset.
 */
export const isSessionValid = (user, decoded) => {
  if (isAdmin(user)) return true;
  const sid = decoded?.sid;
  return Boolean(sid) && sid === user?.activeSessionId;
};
