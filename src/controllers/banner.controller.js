import Banner from "../models/Banner.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const origin = `${req.protocol}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

export const createBanner = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "image file required");
    const image = `/uploads/${req.file.filename}`;
    const doc = await Banner.create({ image, isActive: true });
    const data = { ...doc.toObject(), image: toAbsolute(doc.image, req) };
    return successResponse(res, 201, "Banner created", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getBanners = async (req, res) => {
  try {
    const docs = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
    const data = docs.map(d => ({ ...d.toObject(), image: toAbsolute(d.image, req) }));
    return successResponse(res, 200, "Banners fetched", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Banner.findByIdAndDelete(id);
    if (!doc) return errorResponse(res, 404, "Banner not found");
    return successResponse(res, 200, "Banner deleted");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getAllBannersAdmin = async (req, res) => {
  try {
    const docs = await Banner.find({}).sort({ createdAt: -1 });
    const data = docs.map(d => ({ ...d.toObject(), image: toAbsolute(d.image, req) }));
    return successResponse(res, 200, "Banners fetched successfully", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
