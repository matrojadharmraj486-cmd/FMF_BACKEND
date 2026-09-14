import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { generateToken } from "../utils/jwt.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "familymedicineflashback@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "#@Fmf3705@#";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isAdminRole = (role) => String(role || "").toLowerCase() === "admin";

// The env ADMIN_EMAIL/ADMIN_PASSWORD act as a permanent recovery key: they always
// resolve to the single admin account (creating it on first boot, or promoting an
// existing row) even after the admin has changed their own email/password in the DB.
const matchesEnvCredentials = (email, password) =>
  normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL) && password === ADMIN_PASSWORD;

const resolveAdminForRecovery = async () => {
  let user = await User.findOne({ email: normalizeEmail(ADMIN_EMAIL) });
  if (!user) user = await User.findOne({ role: { $regex: /^admin$/i } });
  if (!user) {
    user = await User.create({
      fullName: ADMIN_NAME,
      email: normalizeEmail(ADMIN_EMAIL),
      role: "Admin",
      password: ADMIN_PASSWORD,
      isVerified: true
    });
  } else if (!isAdminRole(user.role)) {
    user.role = "Admin";
    await user.save();
  }
  return user;
};

const buildAuthPayload = (user) => ({
  token: generateToken(user._id),
  user: {
    id: user._id,
    name: user.fullName,
    email: user.email,
    role: "admin"
  }
});

// Confirms the caller knows the current admin password. Accepts either the password
// stored in the DB or the env recovery password, so an admin who signed in with the
// recovery key can still set new credentials.
const verifyCurrentAdminPassword = async (user, password) => {
  if (user.password && (await user.comparePassword(password))) return true;
  return password === ADMIN_PASSWORD;
};

export const adminLogin = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return errorResponse(res, 400, "email and password are required");

  // 1) Database-backed credentials are the source of truth once the admin sets them.
  const dbUser = await User.findOne({
    email: normalizeEmail(email),
    role: { $regex: /^admin$/i }
  }).select("+password");

  if (dbUser && dbUser.password && (await dbUser.comparePassword(password))) {
    return successResponse(res, 200, "Admin login successful", buildAuthPayload(dbUser));
  }

  // 2) Env recovery/bootstrap key — always valid, never locks the admin out.
  if (matchesEnvCredentials(email, password)) {
    const user = await resolveAdminForRecovery();
    return successResponse(res, 200, "Admin login successful", buildAuthPayload(user));
  }

  return errorResponse(res, 401, "Invalid credentials");
};

export const changeAdminPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return errorResponse(res, 400, "currentPassword and newPassword are required");
  if (String(newPassword).length < 8)
    return errorResponse(res, 400, "New password must be at least 8 characters long");
  if (currentPassword === newPassword)
    return errorResponse(res, 400, "New password must be different from the current password");

  const user = await User.findById(req.user._id).select("+password");
  if (!user) return errorResponse(res, 404, "Admin account not found");

  // 400 (not 401) so the admin panel's 401 interceptor does not force a logout on a typo.
  if (!(await verifyCurrentAdminPassword(user, currentPassword)))
    return errorResponse(res, 400, "Current password is incorrect");

  user.password = newPassword; // hashed by the User pre-save hook
  await user.save();

  return successResponse(res, 200, "Password updated successfully");
};

export const changeAdminEmail = async (req, res) => {
  const { currentPassword, newEmail } = req.body || {};
  if (!currentPassword || !newEmail)
    return errorResponse(res, 400, "currentPassword and newEmail are required");

  const email = normalizeEmail(newEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return errorResponse(res, 400, "Please enter a valid email address");

  const user = await User.findById(req.user._id).select("+password");
  if (!user) return errorResponse(res, 404, "Admin account not found");

  // 400 (not 401) so a wrong password here does not trip the panel's logout interceptor.
  if (!(await verifyCurrentAdminPassword(user, currentPassword)))
    return errorResponse(res, 400, "Current password is incorrect");

  if (email === normalizeEmail(user.email))
    return errorResponse(res, 400, "New email is the same as the current email");

  const taken = await User.findOne({ email, _id: { $ne: user._id } });
  if (taken) return errorResponse(res, 409, "This email is already in use");

  user.email = email;
  try {
    await user.save();
  } catch (err) {
    // Guard against a race on the unique email index.
    if (err?.code === 11000) return errorResponse(res, 409, "This email is already in use");
    throw err;
  }

  return successResponse(res, 200, "Email updated successfully", {
    user: {
      id: user._id,
      name: user.fullName,
      email: user.email,
      role: "admin"
    }
  });
};
