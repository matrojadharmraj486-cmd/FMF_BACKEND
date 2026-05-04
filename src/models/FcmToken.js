import mongoose from "mongoose";

const fcmTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    platform: { type: String, trim: true, default: "" }, // android/ios/web
    deviceId: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("FcmToken", fcmTokenSchema);

