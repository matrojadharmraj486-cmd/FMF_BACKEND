import mongoose from "mongoose";

const isValidHttpUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidRedirectionUrl = (value) => {
  if (!value) return false;
  const v = String(value).trim();
  return v.startsWith("/") || isValidHttpUrl(v);
};

export const BANNER_TYPES = ["type1", "type2", "type3", "type4", "type5"];
export const BANNER_POSITIONS = [1, 2, 3, 4, 5];

const bannerSchema = new mongoose.Schema({
  image: { type: String, required: true },
  imageUrl: { type: String, trim: true },
  redirectionUrl: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: isValidRedirectionUrl,
      message: "redirectionUrl must start with '/' or be a valid absolute URL"
    }
  },
  bannerType: { type: String, required: true, trim: true, enum: BANNER_TYPES },
  position: { type: Number, required: true, enum: BANNER_POSITIONS },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Banner", bannerSchema);
