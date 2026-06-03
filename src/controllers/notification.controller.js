import mongoose from "mongoose";
import FcmToken from "../models/FcmToken.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
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

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const isInvalidFcmTokenError = (code = "") => {
  return [
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument"
  ].includes(code);
};

const sendTokenChunks = async ({ admin, tokenDocs, title, body, data }) => {
  const userResults = new Map();
  const invalidTokens = [];

  tokenDocs.forEach(tokenDoc => {
    const userId = String(tokenDoc.user);
    if (!userResults.has(userId)) {
      userResults.set(userId, { successCount: 0, failureCount: 0 });
    }
  });

  for (const chunk of chunkArray(tokenDocs, 500)) {
    try {
      const resp = await admin.messaging().sendEachForMulticast({
        tokens: chunk.map(tokenDoc => tokenDoc.token),
        notification: { title, body },
        data: toStringData(data)
      });

      resp.responses.forEach((result, index) => {
        const tokenDoc = chunk[index];
        const userId = String(tokenDoc.user);
        const userResult = userResults.get(userId) || { successCount: 0, failureCount: 0 };
        if (result.success) {
          userResult.successCount += 1;
        } else {
          userResult.failureCount += 1;
          const code = result.error?.code;
          if (isInvalidFcmTokenError(code)) invalidTokens.push(tokenDoc.token);
        }
        userResults.set(userId, userResult);
      });
    } catch (e) {
      logger.warn("FCM multicast chunk failed", { error: e.message });
      chunk.forEach(tokenDoc => {
        const userId = String(tokenDoc.user);
        const userResult = userResults.get(userId) || { successCount: 0, failureCount: 0 };
        userResult.failureCount += 1;
        userResults.set(userId, userResult);
      });
    }
  }

  if (invalidTokens.length) {
    await FcmToken.updateMany(
      { token: { $in: invalidTokens } },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );
  }

  return userResults;
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

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Notification.findOneAndUpdate(
      { _id: id, user: req.user?._id },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!doc) return errorResponse(res, 404, "Notification not found");
    return successResponse(res, 200, "Notification marked as read", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user?._id, isRead: false },
      { $set: { isRead: true } }
    );
    return successResponse(res, 200, "All notifications marked as read");
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

export const sendBulkNotificationsAdmin = async (req, res) => {
  try {
    const sendToAll = req.body?.sendToAll === true || String(req.body?.sendToAll).toLowerCase() === "true";
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const data = req.body?.data === undefined ? {} : req.body.data;

    if (!title) {
      return res.status(400).json({ success: false, message: "title is required" });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: "body is required" });
    }
    if (data && (typeof data !== "object" || Array.isArray(data))) {
      return res.status(400).json({ success: false, message: "data must be an object" });
    }

    const requestedUserIds = Array.isArray(req.body?.userIds)
      ? Array.from(new Set(req.body.userIds.map(id => String(id || "").trim()).filter(Boolean)))
      : [];

    if (!sendToAll && !requestedUserIds.length) {
      return res.status(400).json({ success: false, message: "userIds must be a non-empty array when sendToAll is false" });
    }
    if (!sendToAll && requestedUserIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ success: false, message: "userIds contains invalid user id" });
    }

    const userFilter = sendToAll
      ? { isDeleted: { $ne: true } }
      : { _id: { $in: requestedUserIds }, isDeleted: { $ne: true } };
    const users = await User.find(userFilter, { _id: 1 }).lean();
    let targetUserIds = users.map(user => String(user._id));

    if (!targetUserIds.length) {
      return res.status(200).json({
        success: true,
        sent: 0,
        failed: sendToAll ? 0 : requestedUserIds.length,
        totalTargets: sendToAll ? 0 : requestedUserIds.length,
        failedUserIds: sendToAll ? [] : requestedUserIds
      });
    }

    const tokenDocs = await FcmToken.find({
      user: { $in: targetUserIds },
      isActive: true,
      token: { $exists: true, $ne: "" }
    }).lean();

    const tokenUserIds = new Set(tokenDocs.map(tokenDoc => String(tokenDoc.user)));
    const usersWithoutTokens = sendToAll ? [] : targetUserIds.filter(userId => !tokenUserIds.has(userId));
    if (sendToAll) targetUserIds = Array.from(tokenUserIds);

    if (!tokenDocs.length) {
      return res.status(200).json({
        success: true,
        sent: 0,
        failed: usersWithoutTokens.length,
        totalTargets: targetUserIds.length,
        failedUserIds: usersWithoutTokens
      });
    }

    let admin;
    try {
      admin = await getFirebaseAdmin();
    } catch (e) {
      return res.status(503).json({
        success: false,
        message: "Firebase is not configured on the server",
        sent: 0,
        failed: targetUserIds.length,
        totalTargets: targetUserIds.length,
        failedUserIds: targetUserIds
      });
    }

    const userResults = tokenDocs.length
      ? await sendTokenChunks({ admin, tokenDocs, title, body, data })
      : new Map();

    const sentUserIds = [];
    const failedUserIds = [...usersWithoutTokens];

    for (const userId of tokenUserIds) {
      const result = userResults.get(userId);
      if (result?.successCount > 0) {
        sentUserIds.push(userId);
      } else {
        failedUserIds.push(userId);
      }
    }

    const notificationDocs = targetUserIds.map(userId => ({
      user: userId,
      title,
      body,
      data,
      status: sentUserIds.includes(userId) ? "sent" : "failed",
      error: failedUserIds.includes(userId) ? { reason: tokenUserIds.has(userId) ? "send_failed" : "no_active_tokens" } : undefined
    }));
    if (notificationDocs.length) await Notification.insertMany(notificationDocs, { ordered: false });

    logger.info("Bulk notification send attempt", {
      adminId: req.user?._id,
      sendToAll,
      totalTargets: targetUserIds.length,
      sent: sentUserIds.length,
      failed: failedUserIds.length
    });

    return res.status(200).json({
      success: true,
      sent: sentUserIds.length,
      failed: failedUserIds.length,
      totalTargets: targetUserIds.length,
      failedUserIds
    });
  } catch (e) {
    logger.error("Bulk notification send failed", { error: e.message, stack: e.stack });
    return res.status(500).json({ success: false, message: e.message });
  }
};
