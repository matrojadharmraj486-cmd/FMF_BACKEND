import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { sendNotificationToUser } from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/notifications/send", adminAuthenticate, sendNotificationToUser);

export default router;

