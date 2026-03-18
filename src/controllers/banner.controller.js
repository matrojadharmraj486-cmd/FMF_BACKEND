import fs from "fs";
import Banner from "../models/Banner.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { uploadImageFile } from "../utils/cloudinary.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
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

const isValidRedirectionUrl = (value) => {
  if (!value) return false;
  const v = String(value).trim();
  return v.startsWith("/") || isValidHttpUrl(v);
};

export const createBanner = async (req, res) => {
  try {
    console.log("BANNER_CREATE_V2", {
      hasFile: !!req.file,
      bannerType: req.body?.bannerType,
      imageUrl: req.body?.imageUrl,
      redirectionUrl: req.body?.redirectionUrl
    });
    const bannerType = (req.body.bannerType || "").trim();
    if (!bannerType) return errorResponse(res, 400, "bannerType required");
    if (bannerType.length < 2 || bannerType.length > 50) {
      return errorResponse(res, 400, "bannerType must be between 2 and 50 characters");
    }

    const redirectionUrl = (req.body.redirectionUrl || "").trim();
    if (!redirectionUrl) return errorResponse(res, 400, "redirectionUrl required");
    if (!isValidRedirectionUrl(redirectionUrl)) {
      return errorResponse(res, 400, "redirectionUrl must start with '/' or be a valid absolute URL");
    }

    let image = "";
    let imageUrl;
    if (req.file) {
      const uploaded = await uploadImageFile(req.file.path, "fmf/banners");
      image = uploaded.url;
      imageUrl = uploaded.url;
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // ignore cleanup errors
      }
    } else {
      const providedUrl = String(req.body.imageUrl || "").trim();
      if (!providedUrl) return errorResponse(res, 400, "imageUrl required when no image file is provided");
      if (!isValidHttpUrl(providedUrl)) return errorResponse(res, 400, "imageUrl must be a valid URL");
      image = providedUrl;
      imageUrl = providedUrl;
    }

    const doc = await Banner.create({ image, imageUrl, bannerType, redirectionUrl, isActive: true });
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

export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Banner.findById(id);
    if (!doc) return errorResponse(res, 404, "Banner not found");

    if (Object.prototype.hasOwnProperty.call(req.body, "bannerType")) {
      const bannerType = String(req.body.bannerType || "").trim();
      if (!bannerType) return errorResponse(res, 400, "bannerType cannot be empty");
      if (bannerType.length < 2 || bannerType.length > 50) {
        return errorResponse(res, 400, "bannerType must be between 2 and 50 characters");
      }
      doc.bannerType = bannerType;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "redirectionUrl")) {
      const redirectionUrl = String(req.body.redirectionUrl || "").trim();
      if (!redirectionUrl) return errorResponse(res, 400, "redirectionUrl cannot be empty");
      if (!isValidRedirectionUrl(redirectionUrl)) {
        return errorResponse(res, 400, "redirectionUrl must start with '/' or be a valid absolute URL");
      }
      doc.redirectionUrl = redirectionUrl;
    }

    if (req.file) {
      const uploaded = await uploadImageFile(req.file.path, "fmf/banners");
      doc.image = uploaded.url;
      doc.imageUrl = uploaded.url;
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // ignore cleanup errors
      }
    } else if (Object.prototype.hasOwnProperty.call(req.body, "imageUrl")) {
      const providedUrl = String(req.body.imageUrl || "").trim();
      if (!providedUrl) return errorResponse(res, 400, "imageUrl cannot be empty");
      if (!isValidHttpUrl(providedUrl)) return errorResponse(res, 400, "imageUrl must be a valid URL");
      doc.image = providedUrl;
      doc.imageUrl = providedUrl;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      doc.isActive = Boolean(req.body.isActive);
    }

    await doc.save();
    const data = {
      ...doc.toObject(),
      image: toAbsolute(doc.image, req),
      imageUrl: toAbsolute(doc.imageUrl, req)
    };
    return successResponse(res, 200, "Banner updated", data);
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