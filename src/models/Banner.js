import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema({
  image: { type: String, required: true },
  imageUrl: { type: String, trim: true },
  bannerType: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Banner", bannerSchema);
