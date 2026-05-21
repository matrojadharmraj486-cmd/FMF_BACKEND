import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    features: [{ type: String, trim: true }],
    price: { type: Number, required: true }, // INR
    gstPercent: { type: Number, default: 0 }, // 0, 5, 18
    currency: { type: String, default: "INR" },
    durationDays: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);
