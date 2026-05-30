import mongoose from "mongoose";

export const COUPON_DISCOUNT_TYPES = ["percentage", "fixed"];

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    isActive: { type: Boolean, default: true },
    discountType: {
      type: String,
      required: true,
      enum: COUPON_DISCOUNT_TYPES
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Coupon", couponSchema);
