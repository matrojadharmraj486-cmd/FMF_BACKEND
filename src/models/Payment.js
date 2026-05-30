import mongoose from "mongoose";
import Counter from "./Counter.js";

export const getNextOrderNumber = async () => {
  const existing = await Counter.findByIdAndUpdate(
    "paymentOrderNumber",
    { $inc: { seq: 1 } },
    { new: true }
  );
  if (existing) return String(existing.seq);

  try {
    const created = await Counter.create({ _id: "paymentOrderNumber", seq: 1001 });
    return String(created.seq);
  } catch (e) {
    if (e?.code !== 11000) throw e;
    const counter = await Counter.findByIdAndUpdate(
      "paymentOrderNumber",
      { $inc: { seq: 1 } },
      { new: true }
    );
    return String(counter.seq);
  }
};

const paymentSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true, index: true },
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

paymentSchema.pre("validate", async function () {
  if (this.orderNumber) return;
  this.orderNumber = await getNextOrderNumber();
});

export default mongoose.model("Payment", paymentSchema);
