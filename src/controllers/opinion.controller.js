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
