import express from "express";
import { authenticate } from "../middleware/auth.js";
import { createOrder, verifyPayment, handleWebhook, markPaymentFailed, listMyPayments } from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/orders", authenticate, createOrder);
router.get("/history", authenticate, listMyPayments);
router.post("/verify", authenticate, verifyPayment);
router.post("/fail", authenticate, markPaymentFailed);
router.post("/webhook", handleWebhook);

export default router;
