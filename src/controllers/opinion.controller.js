import Opinion from "../models/Opinion.js";
import { successResponse, errorResponse } from "../utils/response.js";

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
    const data = await Opinion.find().sort({ createdAt: -1 });
    return successResponse(res, 200, "Opinions fetched", data);
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
