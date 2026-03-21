import express from "express";
import { listActiveSubscriptions } from "../controllers/subscription.controller.js";

const router = express.Router();

router.get("/subscriptions", listActiveSubscriptions);

export default router;
