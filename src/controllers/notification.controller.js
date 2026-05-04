import FcmToken from "../models/FcmToken.js";
import Notification from "../models/Notification.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getFirebaseAdmin } from "../utils/firebase.js";
import { logger } from "../utils/logger.js";

const toStringData = (data) => {
  const obj = data && typeof data === "object" ? data : {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    out[String(k)] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
};

export const registerFcmToken = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return errorResponse(res, 400, "token is required");

    const platform = String(req.body?.platform || "").trim();
    const deviceId = String(req.body?.deviceId || "").trim();

    const doc = await FcmToken.findOneAndUpdate(
      { token },
      {
        $set: {
          user: req.user?._id,
          platform,
          deviceId,
          isActive: true,
          lastSeenAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    return successResponse(res, 200, "Token registered", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const unregisterFcmToken = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return errorResponse(res, 400, "token is required");

    await FcmToken.updateOne(
      { token, user: req.user?._id },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );

    return successResponse(res, 200, "Token unregistered");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const listMyNotifications = async (req, res) => {
  try {
    const docs = await Notification.find({ user: req.user?._id }).sort({ createdAt: -1 }).limit(100);
    return successResponse(res, 200, "Notifications fetched", docs);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const sendNotificationToUser = async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const data = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
    if (!userId) return errorResponse(res, 400, "userId is required");
    if (!title || !body) return errorResponse(res, 400, "title and body are required");

    const notification = await Notification.create({
      user: userId,
      title,
      body,
      data,
      status: "queued"
    });

    const tokens = await FcmToken.find({ user: userId, isActive: true }).lean();
    const tokenValues = tokens.map(t => t.token).filter(Boolean);
    if (!tokenValues.length) {
      notification.status = "failed";
      notification.error = { reason: "no_active_tokens" };
      await notification.save();
      return errorResponse(res, 400, "User has no active device tokens");
    }

    let admin;
    try {
      admin = await getFirebaseAdmin();
    } catch (e) {
      notification.status = "failed";
      notification.error = { reason: e.code || "firebase_error", message: e.message };
      await notification.save();
      return errorResponse(res, 503, "Firebase is not configured on the server");
    }

    const message = {
      tokens: tokenValues,
      notification: { title, body },
      data: toStringData(data)
    };

    const resp = await admin.messaging().sendEachForMulticast(message);
    notification.status = resp.failureCount > 0 && resp.successCount === 0 ? "failed" : "sent";
    notification.error = resp.failureCount
      ? {
          successCount: resp.successCount,
          failureCount: resp.failureCount,
          responses: resp.responses
            .filter(r => !r.success)
            .map(r => ({ code: r.error?.code, message: r.error?.message }))
        }
      : undefined;
    await notification.save();

    logger.info("Notification send attempt", {
      notificationId: notification._id,
      userId,
      successCount: resp.successCount,
      failureCount: resp.failureCount,
      adminId: req.user?._id
    });

    return successResponse(res, 200, "Notification sent", {
      notificationId: notification._id,
      successCount: resp.successCount,
      failureCount: resp.failureCount
    });
  } catch (e) {
    logger.error("Send notification failed", { error: e.message, stack: e.stack });
    return errorResponse(res, 500, e.message);
  }
};

