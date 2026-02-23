import Banner from "../models/Banner.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const createBanner = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "image file required");
    const image = `/uploads/${req.file.filename}`;
    const doc = await Banner.create({ image, isActive: true });
    return successResponse(res, 201, "Banner created", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getBanners = async (req, res) => {
  try {
    const docs = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
    return successResponse(res, 200, "Banners fetched", docs);
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

