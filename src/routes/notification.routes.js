import express from "express";
import { authenticate } from "../middleware/auth.js";
import { listMyNotifications, registerFcmToken, unregisterFcmToken } from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/notifications/register", authenticate, registerFcmToken);
router.post("/notifications/unregister", authenticate, unregisterFcmToken);
router.get("/notifications", authenticate, listMyNotifications);

export default router;

