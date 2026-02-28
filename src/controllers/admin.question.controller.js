import Question from "../models/Question.js";
import { successResponse, errorResponse } from "../utils/response.js";
import xlsx from "xlsx";

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
    const origin = `${req.protocol}://${req.get("host")}`;
    const data = docs.map(d => {
      const obj = d.toObject();
      if (obj.answerType === "image" && obj.answerImage && !obj.answerImage.startsWith("http")) {
        obj.answerImage = `${origin}${obj.answerImage}`;
      }
      return obj;
    });
    return successResponse(res, 200, "Questions fetched", data);
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

export const uploadQuestionsExcel = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "file required");
    const overrideYear = req.body.year ? Number(req.body.year) : undefined;
    const overridePart = req.body.part;
    const wb = xlsx.readFile(req.file.path);
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
    if (!rows.length) return errorResponse(res, 400, "file is empty");
    const docs = [];
    for (const r of rows) {
      const year = overrideYear ?? Number(r.year);
      const part = overridePart ?? String(r.part || "").trim();
      const question = String(r.question || "").trim();
      const answerType = String(r.answerType || "").trim().toLowerCase();
      const answerText = String(r.answerText || "").trim();
      const answerImage = String(r.answerImage || "").trim();
      if (!year || !part || !question || !answerType)
        return errorResponse(res, 400, "year, part, question, answerType required in each row or via form fields");
      if (!["text", "image"].includes(answerType))
        return errorResponse(res, 400, "answerType must be 'text' or 'image'");
      if (answerType === "text" && !answerText)
        return errorResponse(res, 400, "answerText required for text rows");
      if (answerType === "image" && !answerImage)
        return errorResponse(res, 400, "answerImage required for image rows");
      const payload = { year, part, question, answerType };
      if (answerType === "text") payload.answerText = answerText;
      else payload.answerImage = answerImage.startsWith("/") ? answerImage : `/uploads/${answerImage}`;
      docs.push(payload);
    }
    const inserted = await Question.insertMany(docs);
    return successResponse(res, 201, "Questions uploaded", { inserted: inserted.length });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
