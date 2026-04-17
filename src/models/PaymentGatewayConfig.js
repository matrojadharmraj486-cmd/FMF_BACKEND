import mongoose from "mongoose";

const paymentGatewayConfigSchema = new mongoose.Schema(
  {
    gateway: { type: String, required: true, enum: ["razorpay"], unique: true },
    keyId: { type: String, required: true, trim: true },
    saltId: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("PaymentGatewayConfig", paymentGatewayConfigSchema);

