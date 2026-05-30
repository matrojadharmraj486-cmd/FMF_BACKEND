import mongoose from "mongoose";
import Coupon, { COUPON_DISCOUNT_TYPES } from "../models/Coupon.js";

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};

const parseDiscountValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const success = (res, status, data) => res.status(status).json({ success: true, data });
const failure = (res, status, message) => res.status(status).json({ success: false, message });

export const listCouponsAdmin = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return success(res, 200, coupons);
  } catch (e) {
    return failure(res, 500, e.message);
  }
};

export const createCouponAdmin = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const discountType = String(req.body?.discountType || "").trim().toLowerCase();
    const discountValue = parseDiscountValue(req.body?.discountValue);
    const description = String(req.body?.description || "").trim();
    const isActive = parseBoolean(req.body?.isActive, true);

    if (!code) return failure(res, 400, "code is required");
    if (isActive === null) return failure(res, 400, "isActive must be boolean");
    if (!COUPON_DISCOUNT_TYPES.includes(discountType)) {
      return failure(res, 400, "discountType must be one of percentage, fixed");
    }
    if (discountValue === null || discountValue <= 0) {
      return failure(res, 400, "discountValue must be greater than 0");
    }
    if (discountType === "percentage" && discountValue > 100) {
      return failure(res, 400, "percentage discountValue must be <= 100");
    }
    if (!description) return failure(res, 400, "description is required");

    const coupon = await Coupon.create({
      code,
      isActive,
      discountType,
      discountValue,
      description
    });

    return success(res, 201, coupon);
  } catch (e) {
    if (e?.code === 11000) {
      return failure(res, 409, "Coupon code already exists");
    }
    return failure(res, 500, e.message);
  }
};

export const deleteCouponAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return failure(res, 400, "Invalid coupon id");

    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) return failure(res, 404, "Coupon not found");

    return success(res, 200, { deleted: true });
  } catch (e) {
    return failure(res, 500, e.message);
  }
};
