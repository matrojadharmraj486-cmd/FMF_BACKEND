import Banner from "../models/Banner.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const origin = `${req.protocol}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const isValidHttpUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const createBanner = async (req, res) => {
  try {
    console.log("BANNER_CREATE_V2", {
      hasFile: !!req.file,
      bannerType: req.body?.bannerType,
      imageUrl: req.body?.imageUrl
    });
    const bannerType = (req.body.bannerType || "").trim();
    if (!bannerType) return errorResponse(res, 400, "bannerType required");
    if (bannerType.length < 2 || bannerType.length > 50) {
      return errorResponse(res, 400, "bannerType must be between 2 and 50 characters");
    }

    let image = "";
    let imageUrl;
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    } else {
      const providedUrl = String(req.body.imageUrl || "").trim();
      if (!providedUrl) return errorResponse(res, 400, "imageUrl required when no image file is provided");
      if (!isValidHttpUrl(providedUrl)) return errorResponse(res, 400, "imageUrl must be a valid URL");
      image = providedUrl;
      imageUrl = providedUrl;
    }

    const doc = await Banner.create({ image, imageUrl, bannerType, isActive: true });
    const data = {
      ...doc.toObject(),
      image: toAbsolute(doc.image, req),
      imageUrl: toAbsolute(doc.imageUrl, req)
    };
    return successResponse(res, 201, "Banner created", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getBanners = async (req, res) => {
  try {
    const bannerType = (req.query.bannerType || "").trim();
    const filter = { isActive: true };
    if (bannerType) filter.bannerType = bannerType;
    const docs = await Banner.find(filter).sort({ createdAt: -1 });
    const data = docs.map(d => ({
      ...d.toObject(),
      image: toAbsolute(d.image, req),
      imageUrl: toAbsolute(d.imageUrl, req)
    }));
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
    const bannerType = (req.query.bannerType || "").trim();
    const filter = {};
    if (bannerType) filter.bannerType = bannerType;
    const docs = await Banner.find(filter).sort({ createdAt: -1 });
    const data = docs.map(d => ({
      ...d.toObject(),
      image: toAbsolute(d.image, req),
      imageUrl: toAbsolute(d.imageUrl, req)
    }));
    return successResponse(res, 200, "Banners fetched successfully", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
