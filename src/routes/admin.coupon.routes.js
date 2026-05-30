import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  createCouponAdmin,
  deleteCouponAdmin,
  listCouponsAdmin
} from "../controllers/admin.coupon.controller.js";

const router = express.Router();

router.get("/coupons", adminAuthenticate, listCouponsAdmin);
router.post("/coupons", adminAuthenticate, createCouponAdmin);
router.delete("/coupons/:id", adminAuthenticate, deleteCouponAdmin);

export default router;
