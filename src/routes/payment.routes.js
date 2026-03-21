import express from "express";
import { authenticate } from "../middleware/auth.js";
import { createOrder, verifyPayment, handleWebhook } from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/orders", authenticate, createOrder);
router.post("/verify", authenticate, verifyPayment);
router.post("/webhook", handleWebhook);

export default router;
