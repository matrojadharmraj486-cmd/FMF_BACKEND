import Question from "../models/Question.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const createQuestion = async (req, res) => {
  try {
    const { year, part, question, answerType, answerText } = req.body;
    if (!year || !part || !question || !answerType)
      return errorResponse(res, 400, "year, part, question, answerType required");
    if (!["text", "image"].includes(answerType))
      return errorResponse(res, 400, "answerType must be 'text' or 'image'");
    let doc = null;
    if (answerType === "text") {
      if (!answerText) return errorResponse(res, 400, "answerText required for text type");
      doc = await Question.create({ year, part, question, answerType, answerText });
    } else {
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
      if (!fileUrl) return errorResponse(res, 400, "answerImage file required for image type");
      doc = await Question.create({ year, part, question, answerType, answerImage: fileUrl });
    }
    return successResponse(res, 201, "Question created", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getQuestions = async (req, res) => {
  try {
    const { year, part } = req.query;
    const filter = {};
    if (year) filter.year = Number(year);
    if (part) filter.part = part;
    const docs = await Question.find(filter).sort({ year: -1, part: 1, createdAt: -1 });
    return successResponse(res, 200, "Questions fetched", docs);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    if (req.file) payload.answerImage = `/uploads/${req.file.filename}`;
    if (payload.answerType && !["text", "image"].includes(payload.answerType))
      return errorResponse(res, 400, "answerType must be 'text' or 'image'");
    const doc = await Question.findByIdAndUpdate(id, payload, { new: true });
    if (!doc) return errorResponse(res, 404, "Question not found");
    return successResponse(res, 200, "Question updated", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Question.findByIdAndDelete(id);
    if (!doc) return errorResponse(res, 404, "Question not found");
    return successResponse(res, 200, "Question deleted");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

