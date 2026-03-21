import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true
    },
    provider: { type: String, default: "razorpay" },
    amount: { type: Number, required: true }, // paise
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created"
    },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
    receipt: String,
    method: String,
    notes: Object,
    error: Object
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
