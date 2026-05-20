import Opinion from "../models/Opinion.js";
import { successResponse, errorResponse } from "../utils/response.js";

const ALLOWED_LIMITS = new Set([10, 20, 50, 100]);

const parsePositiveInt = (value) => {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  return i > 0 ? i : undefined;
};

export const createOpinion = async (req, res) => {
  const { name, opinion } = req.body;

  if (!name || !opinion) {
    return errorResponse(res, 400, "Name and opinion are required");
  }

  const data = await Opinion.create({ name, opinion });

  return successResponse(res, 201, "Opinion created", data);
};

export const getOpinions = async (req, res) => {
  const data = await Opinion.find().sort({ createdAt: -1 });

  return successResponse(res, 200, "Opinions fetched", data);
};

export const listOpinionsAdmin = async (req, res) => {
  try {
    const { q, page, limit } = req.query || {};

    const wantsPagination = page !== undefined || limit !== undefined;
    const parsedPage = parsePositiveInt(page) || 1;
    const parsedLimitRaw = parsePositiveInt(limit);
    let parsedLimit = wantsPagination ? 20 : undefined;
    if (parsedLimitRaw !== undefined) {
      if (parsedLimitRaw > 100) parsedLimit = 100;
      else if (ALLOWED_LIMITS.has(parsedLimitRaw)) parsedLimit = parsedLimitRaw;
    }

    const filter = {};
    const term = String(q || "").trim();
    if (term) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [{ name: regex }, { opinion: regex }];
    }

    if (!wantsPagination) {
      const data = await Opinion.find(filter).sort({ createdAt: -1 });
      return successResponse(res, 200, "Opinions fetched", data);
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [data, total] = await Promise.all([
      Opinion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
      Opinion.countDocuments(filter)
    ]);
    const totalPages = Math.max(1, Math.ceil(total / parsedLimit));
    return successResponse(res, 200, "Opinions fetched", {
      data,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteOpinion = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Opinion.findByIdAndDelete(id);
    if (!doc) return errorResponse(res, 404, "Opinion not found");
    return successResponse(res, 200, "Opinion deleted");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const bulkDeleteOpinions = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const normalized = ids.map(String).filter(Boolean);
    if (!normalized.length) return errorResponse(res, 400, "ids array required");
    const result = await Opinion.deleteMany({ _id: { $in: normalized } });
    return successResponse(res, 200, "Opinions deleted", { deleted: result.deletedCount || 0 });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
