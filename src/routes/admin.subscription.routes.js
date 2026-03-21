import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  createSubscription,
  listSubscriptions,
  updateSubscription,
  updateSubscriptionStatus
} from "../controllers/admin.subscription.controller.js";

const router = express.Router();

router.post("/subscriptions", adminAuthenticate, createSubscription);
router.get("/subscriptions", adminAuthenticate, listSubscriptions);
router.put("/subscriptions/:id", adminAuthenticate, updateSubscription);
router.patch("/subscriptions/:id/status", adminAuthenticate, updateSubscriptionStatus);

export default router;
