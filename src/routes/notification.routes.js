import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  listMyNotifications,
  registerFcmToken,
  unregisterFcmToken,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/notifications/register", authenticate, registerFcmToken);
router.post("/notifications/unregister", authenticate, unregisterFcmToken);
router.get("/notifications", authenticate, listMyNotifications);
router.patch("/notifications/:id/read", authenticate, markNotificationAsRead);
router.patch("/notifications/read-all", authenticate, markAllNotificationsAsRead);

export default router;

