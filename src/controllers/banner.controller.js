import fs from "fs";
import Banner, { BANNER_TYPES, BANNER_POSITIONS } from "../models/Banner.js";
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

const parseBannerType = (value) => {
  const bannerType = String(value || "").trim();
  return BANNER_TYPES.includes(bannerType) ? bannerType : null;
};

const parsePosition = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const position = Number(value);
  return Number.isInteger(position) && BANNER_POSITIONS.includes(position) ? position : null;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

const hasActiveBannerAtPosition = async (position, excludeId) => {
  const filter = { isActive: true, position };
  if (excludeId) filter._id = { $ne: excludeId };
  return Boolean(await Banner.exists(filter));
};

const hasActiveBannerCapacity = async (excludeId) => {
  const filter = { isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  const activeCount = await Banner.countDocuments(filter);
  return activeCount < BANNER_POSITIONS.length;
};

export const createBanner = async (req, res) => {
  try {
    console.log("BANNER_CREATE_V2", {
      hasFile: !!req.file,
      bannerType: req.body?.bannerType,
      position: req.body?.position,
      imageUrl: req.body?.imageUrl,
      redirectionUrl: req.body?.redirectionUrl
    });
    const bannerType = parseBannerType(req.body.bannerType);
    if (!bannerType) return errorResponse(res, 400, "bannerType must be one of type1, type2, type3, type4, type5");

    const position = parsePosition(req.body.position);
    if (!position) return errorResponse(res, 400, "position must be a number between 1 and 5");

    if (!await hasActiveBannerCapacity()) {
      return errorResponse(res, 400, "Maximum 5 active banners allowed");
    }

    if (await hasActiveBannerAtPosition(position)) {
      return errorResponse(res, 400, `An active banner already exists at position ${position}`);
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

    const doc = await Banner.create({ image, imageUrl, bannerType, position, redirectionUrl, isActive: true });
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
    const docs = await Banner.find(filter).sort({ position: 1, createdAt: -1 });
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
      const bannerType = parseBannerType(req.body.bannerType);
      if (!bannerType) return errorResponse(res, 400, "bannerType must be one of type1, type2, type3, type4, type5");
      doc.bannerType = bannerType;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "position")) {
      const position = parsePosition(req.body.position);
      if (!position) return errorResponse(res, 400, "position must be a number between 1 and 5");
      if (doc.isActive && await hasActiveBannerAtPosition(position, id)) {
        return errorResponse(res, 400, `An active banner already exists at position ${position}`);
      }
      doc.position = position;
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
      const isActive = parseBoolean(req.body.isActive);
      if (isActive && !doc.position) {
        return errorResponse(res, 400, "position must be a number between 1 and 5");
      }
      if (isActive && !await hasActiveBannerCapacity(id)) {
        return errorResponse(res, 400, "Maximum 5 active banners allowed");
      }
      doc.isActive = isActive;
      if (isActive && await hasActiveBannerAtPosition(doc.position, id)) {
        return errorResponse(res, 400, `An active banner already exists at position ${doc.position}`);
      }
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
    const docs = await Banner.find(filter).sort({ position: 1, createdAt: -1 });
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
