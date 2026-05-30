import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  sendBulkNotificationsAdmin,
  sendNotificationToUser
} from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/notifications/send", adminAuthenticate, sendNotificationToUser);
router.post("/notifications/send-bulk", adminAuthenticate, sendBulkNotificationsAdmin);

export default router;
