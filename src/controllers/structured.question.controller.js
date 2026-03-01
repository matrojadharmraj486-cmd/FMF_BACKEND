import xlsx from "xlsx";
import StructuredQuestion from "../models/StructuredQuestion.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const origin = `${req.protocol}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const normalizePart = (raw) => {
  const s = String(raw || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
  if (["part1", "1", "p1"].includes(s)) return "Part 1";
  if (["part2", "2", "p2"].includes(s)) return "Part 2";
  return null;
};

export const getStructuredQuestions = async (req, res) => {
  try {
    const { year, part } = req.query;
    const filter = {};
    if (year) filter.year = Number(year);
    if (part) {
      const p = normalizePart(part) || part;
      filter.part = p;
    }
    const docs = await StructuredQuestion.find(filter).sort({ year: -1, part: 1, createdAt: -1 });
    const data = docs.map(d => {
      const obj = d.toObject();
      obj.id = obj.id || String(obj._id);
      obj.sub_questions = (obj.sub_questions || []).map(sq => {
        if (sq.answerType === "image" && sq.answerImage) {
          sq.answerImage = toAbsolute(sq.answerImage, req);
        }
        return sq;
      });
      return obj;
    });
    return successResponse(res, 200, "Questions fetched successfully", {
      total: data.length,
      questions: data
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const uploadStructuredExcel = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "file required");
    const overrideYear = req.body.year ? Number(req.body.year) : undefined;
    const overridePart = normalizePart(req.body.part) || req.body.part;
    const wb = xlsx.readFile(req.file.path);
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
    if (!rows.length) return errorResponse(res, 400, "file is empty");
    // expected columns: groupId, year, part, question_text, sub_part, sub_text, answerType, answerText, answerImage
    const groups = new Map();
    for (const r of rows) {
      const groupId = String(r.groupId || r.id || "").trim();
      const year = overrideYear ?? Number(r.year);
      const partCandidate = overridePart ?? (normalizePart(r.part) || String(r.part || "").trim());
      const part = normalizePart(partCandidate) || partCandidate;
      const question_text = String(r.question_text || r.questionText || "").trim();
      const sub_part = String(r.sub_part || r.subPart || "").trim(); // e.g., "a"
      const sub_text = String(r.sub_text || r.subText || "").trim();
      const answerType = String(r.answerType || "text").trim().toLowerCase();
      const answerText = String(r.answerText || "").trim();
      const answerImage = String(r.answerImage || "").trim();
      if (!year || !question_text || !sub_part || !sub_text)
        return errorResponse(res, 400, "year, part, question_text, sub_part, sub_text required");
      if (!["Part 1", "Part 2"].includes(part))
        return errorResponse(res, 400, "part must be 'Part 1' or 'Part 2'");
      if (!["text", "image"].includes(answerType))
        return errorResponse(res, 400, "answerType must be 'text' or 'image'");
      const key = groupId || `${year}-${part}-${question_text}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: groupId || undefined,
          year,
          part,
          question_text,
          sub_questions: []
        });
      }
      const sub = { part: sub_part, text: sub_text, answerType };
      if (answerType === "text") {
        sub.answer = answerText ? answerText.split(";").map(s => s.trim()).filter(Boolean) : [];
      } else {
        sub.answerImage = answerImage.startsWith("http") || answerImage.startsWith("/uploads/")
          ? answerImage
          : `/uploads/${answerImage}`;
      }
      groups.get(key).sub_questions.push(sub);
    }
    const docs = Array.from(groups.values());
    const inserted = await StructuredQuestion.insertMany(docs);
    return successResponse(res, 201, "Structured questions uploaded", { inserted: inserted.length });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const adminListStructuredQuestions = async (req, res) => {
  try {
    const { year, part } = req.query;
    const filter = {};
    if (year) filter.year = Number(year);
    if (part) {
      const p = normalizePart(part) || part;
      filter.part = p;
    }
    const docs = await StructuredQuestion.find(filter).sort({ year: -1, part: 1, createdAt: -1 });
    const data = docs.map(d => {
      const obj = d.toObject();
      obj.id = obj.id || String(obj._id);
      obj.sub_questions = (obj.sub_questions || []).map(sq => {
        if (sq.answerType === "image" && sq.answerImage) {
          sq.answerImage = toAbsolute(sq.answerImage, req);
        }
        return sq;
      });
      return obj;
    });
    return successResponse(res, 200, "Admin questions fetched", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateStructuredQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    const doc = await StructuredQuestion.findByIdAndUpdate(id, payload, { new: true });
    if (!doc) return errorResponse(res, 404, "Question not found");
    return successResponse(res, 200, "Question updated", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteStructuredQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await StructuredQuestion.findByIdAndDelete(id);
    if (!doc) return errorResponse(res, 404, "Question not found");
    return successResponse(res, 200, "Question deleted");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateStructuredSub = async (req, res) => {
  try {
    const { id, subId } = req.params;
    const doc = await StructuredQuestion.findById(id);
    if (!doc) return errorResponse(res, 404, "Question not found");
    const sub = doc.sub_questions.id(subId);
    if (!sub) return errorResponse(res, 404, "Sub-question not found");
    const { part, text, answerType, answer, answerImage } = req.body;
    if (part) sub.part = part;
    if (text) sub.text = text;
    if (answerType) sub.answerType = answerType;
    if (answerType === "text") {
      sub.answerImage = undefined;
      sub.answer = Array.isArray(answer) ? answer : (answer ? String(answer).split(";").map(s => s.trim()) : []);
    } else if (answerType === "image") {
      sub.answer = [];
      if (answerImage) sub.answerImage = answerImage.startsWith("http") ? answerImage : `/uploads/${answerImage}`;
    }
    await doc.save();
    return successResponse(res, 200, "Sub-question updated", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteStructuredSub = async (req, res) => {
  try {
    const { id, subId } = req.params;
    const doc = await StructuredQuestion.findById(id);
    if (!doc) return errorResponse(res, 404, "Question not found");
    const sub = doc.sub_questions.id(subId);
    if (!sub) return errorResponse(res, 404, "Sub-question not found");
    sub.deleteOne();
    await doc.save();
    return successResponse(res, 200, "Sub-question deleted");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const uploadStructuredSubImage = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "image file required");
    const url = `/uploads/${req.file.filename}`;
    const absolute = toAbsolute(url, req);
    return successResponse(res, 200, "Image uploaded", { url: absolute });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
