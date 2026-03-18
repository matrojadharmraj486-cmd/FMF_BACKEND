import fs from "fs";
import path from "path";
import Testimonial from "../models/Testimonial.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { uploadImageFile } from "../utils/cloudinary.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const tryDeleteLocalFile = async (url) => {
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.join(process.cwd(), url);
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore missing file or fs errors
  }
};

export const createTestimonial = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "photo file required");
    const name = String(req.body.name || "").trim();
    const designation = String(req.body.designation || "").trim();
    const location = String(req.body.location || "").trim();
    const review = String(req.body.review || "").trim();

    if (!name || !designation || !location || !review) {
      return errorResponse(res, 400, "name, designation, location, review required");
    }

    const uploaded = await uploadImageFile(req.file.path, "fmf/testimonials");
    const photoUrl = uploaded.url;
    try {
      await fs.promises.unlink(req.file.path);
    } catch {
      // ignore cleanup errors
    }
    const doc = await Testimonial.create({ photoUrl, name, designation, location, review });
    const data = {
      ...doc.toObject(),
      photoUrl: toAbsolute(doc.photoUrl, req)
    };
    return successResponse(res, 201, "Testimonial created", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getTestimonialsAdmin = async (req, res) => {
  try {
    const docs = await Testimonial.find({}).sort({ createdAt: -1 });
    const data = docs.map(d => ({
      ...d.toObject(),
      photoUrl: toAbsolute(d.photoUrl, req)
    }));
    return successResponse(res, 200, "Testimonials fetched", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getTestimonialsPublic = async (req, res) => {
  try {
    const docs = await Testimonial.find({}).sort({ createdAt: -1 });
    const data = docs.map(d => ({
      ...d.toObject(),
      photoUrl: toAbsolute(d.photoUrl, req)
    }));
    return successResponse(res, 200, "Testimonials fetched", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Testimonial.findByIdAndDelete(id);
    if (!doc) return errorResponse(res, 404, "Testimonial not found");
    await tryDeleteLocalFile(doc.photoUrl);
    return successResponse(res, 200, "Testimonial deleted", { success: true });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
