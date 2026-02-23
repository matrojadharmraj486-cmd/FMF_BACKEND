import Qotd from "../models/Qotd.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const upsertQotd = async (req, res) => {
  try {
    const { question, answerType, answerText } = req.body;
    if (!question || !answerType)
      return errorResponse(res, 400, "question and answerType required");
    if (!["text", "image"].includes(answerType))
      return errorResponse(res, 400, "answerType must be 'text' or 'image'");

    let payload = { question, answerType, isActive: true };
    if (answerType === "text") {
      if (!answerText) return errorResponse(res, 400, "answerText required for text type");
      payload.answerText = answerText;
    } else {
      const url = req.file ? `/uploads/${req.file.filename}` : undefined;
      if (!url) return errorResponse(res, 400, "answerImage file required for image type");
      payload.answerImage = url;
    }

    await Qotd.updateMany({ isActive: true }, { $set: { isActive: false } });
    const doc = await Qotd.create(payload);
    return successResponse(res, 201, "QOTD set", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getActiveQotd = async (req, res) => {
  try {
    const doc = await Qotd.findOne({ isActive: true }).sort({ createdAt: -1 });
    return successResponse(res, 200, "QOTD fetched", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

