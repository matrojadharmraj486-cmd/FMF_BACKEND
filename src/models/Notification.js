import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    data: { type: Object, default: {} },
    status: {
      type: String,
      enum: ["queued", "sent", "failed"],
      default: "queued",
      index: true
    },
    provider: { type: String, default: "fcm" },
    error: { type: Object }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);

