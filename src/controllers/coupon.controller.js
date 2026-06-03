import Coupon from "../models/Coupon.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const validateCoupon = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!code) return errorResponse(res, 400, "Coupon code is required");

    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) return errorResponse(res, 404, "Invalid or inactive coupon code");

    return successResponse(res, 200, "Coupon validated", {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      description: coupon.description
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const listActiveCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({ isActive: true }).select("code discountType discountValue description");
    return successResponse(res, 200, "Active coupons fetched", coupons);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
