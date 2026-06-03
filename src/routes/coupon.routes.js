import express from "express";
import { authenticate } from "../middleware/auth.js";
import { validateCoupon, listActiveCoupons } from "../controllers/coupon.controller.js";

const router = express.Router();

// Publicly list active coupons (optional, but helpful for UI)
router.get("/coupons", authenticate, listActiveCoupons);

// Validate a coupon code
router.post("/coupons/validate", authenticate, validateCoupon);

export default router;
