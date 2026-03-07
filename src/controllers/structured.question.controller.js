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

const normalizeHeader = (key) =>
  String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const pickValue = (row, aliases) => {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const wanted = normalizeHeader(alias);
    for (const [k, v] of entries) {
      if (normalizeHeader(k) === wanted) return v;
    }
  }
  return "";
};

const parseSubPartFromToken = (token, fallback = "a") => {
  const s = String(token || "").trim();
  if (!s) return fallback;
  const m = s.match(/(\d+)$/);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return String.fromCharCode(96 + n);
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
    const headerKeys = rows.length ? Object.keys(rows[0]) : [];
    const normalizedHeaders = new Set(headerKeys.map(normalizeHeader));
    const aliases = {
      groupId: ["groupId", "group_id", "group", "question_id", "questionid", "qid", "id"],
      year: ["year", "exam_year", "session_year"],
      part: ["part", "paper_part", "module_part"],
      questionText: ["question_text", "questionText", "question", "stem", "case_scenario", "clinical_scenario", "main_question_text"],
      mainQuestionAnswer: ["main_question_answer"],
      subPart: ["sub_part", "subPart", "subquestion_part", "part_label", "sub_q_part", "sub_question_no"],
      subText: ["sub_text", "subText", "sub_question", "subQuestion", "sub_question_text", "medical_reference", "reference_text", "reference", "sub_question_text"],
      answerType: ["answerType", "answer_type", "type", "response_type", "format", "question_type_1", "question_type"],
      answerText: ["answerText", "answer_text", "answer", "model_answer", "response", "text_answer", "sub_question_answer"],
      answerImage: ["answerImage", "answer_image", "image", "image_url", "imageurl", "url", "answer_media"]
    };
    let docs = [];
    const partNormalized = normalizePart(overridePart) || overridePart;
    const parseNumberToLetter = (n) => {
      const i = parseInt(n, 10);
      return String.fromCharCode(96 + (isNaN(i) ? 1 : i));
    };
    const hasStructuredHeaders =
      rows.length &&
      (
        aliases.questionText.some((k) => normalizedHeaders.has(normalizeHeader(k))) ||
        aliases.subText.some((k) => normalizedHeaders.has(normalizeHeader(k)))
      );

    if (hasStructuredHeaders) {
      if (!rows.length) return errorResponse(res, 400, "file is empty");
      const groups = new Map();
      for (const r of rows) {
        const groupId = String(pickValue(r, aliases.groupId) || "").trim();
        const year = (overrideYear ?? Number(pickValue(r, aliases.year))) || new Date().getFullYear();
        const rawPart = pickValue(r, aliases.part);
        const partCandidate = partNormalized ?? (normalizePart(rawPart) || String(rawPart || "").trim() || "Part 1");
        const part = normalizePart(partCandidate) || partCandidate;
        const question_text = String(pickValue(r, aliases.questionText) || "").trim();
        const mainQuestionAnswer = String(pickValue(r, aliases.mainQuestionAnswer) || "").trim();
        const subPartRaw = String(pickValue(r, aliases.subPart) || "").trim();
        const subTextRaw = String(pickValue(r, aliases.subText) || "").trim();
        const rawAnswerType = String(pickValue(r, aliases.answerType) || "text").trim().toLowerCase();
        const answerType = ["image", "img", "photo", "figure"].includes(rawAnswerType) ? "image" : "text";
        let answerText = String(pickValue(r, aliases.answerText) || "").trim();
        const answerImage = String(pickValue(r, aliases.answerImage) || "").trim();
        const isDirectRow = !subPartRaw && !subTextRaw;
        const sub_part = isDirectRow ? "a" : parseSubPartFromToken(subPartRaw, "a");
        const sub_text = isDirectRow ? question_text : subTextRaw;
        if (isDirectRow && !answerText && mainQuestionAnswer) answerText = mainQuestionAnswer;
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
      docs = Array.from(groups.values());
    } else {
      const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });
      const lines = raw.flat().map(v => String(v || "").trim()).filter(v => v.length > 0);
      const year = overrideYear;
      const part = normalizePart(partNormalized) || partNormalized;
      if (!year || !part) return errorResponse(res, 400, "year and part required");
      const parents = [];
      let i = 0;
      while (i < lines.length) {
        const token = lines[i];
        if (token.toLowerCase() === "answer") {
          const q = lines[i + 1] || "";
          const ans = [];
          let j = i + 2;
          while (j < lines.length) {
            const t = lines[j];
            if (/^\d+(\.\d+)?$/.test(t) || ["answer", "image"].includes(t.toLowerCase())) break;
            ans.push(t);
            j++;
          }
          parents.push({
            id: undefined,
            year,
            part,
            question_text: q,
            sub_questions: [{ part: "a", text: q, answerType: "text", answer: ans }]
          });
          i = j;
          continue;
        }
        if (/^\d+$/.test(token)) {
          const qText = lines[i + 2] || lines[i + 1] || "";
          const subs = [];
          let j = i + 3;
          let subIndex = 1;
          while (j < lines.length) {
            const t = lines[j];
            if (/^\d+$/.test(t)) break;
            if (/^\d+\.\d+$/.test(t)) {
              j++;
              const nextToken = lines[j] ? lines[j].toLowerCase() : "";
              if (nextToken === "answer") {
                const subQ = lines[j + 1] || "";
                const subAns = [];
                let k = j + 2;
                while (k < lines.length) {
                  const nt = lines[k];
                  if (/^\d+(\.\d+)?$/.test(nt) || ["answer", "image"].includes(nt.toLowerCase())) break;
                  subAns.push(nt);
                  k++;
                }
                subs.push({ part: parseNumberToLetter(subIndex), text: subQ, answerType: "text", answer: subAns });
                subIndex++;
                j = k;
              } else if (nextToken === "image") {
                const subQ = lines[j + 1] || "";
                const imgUrl = lines[j + 3] || lines[j + 2] || "";
                subs.push({ part: parseNumberToLetter(subIndex), text: subQ, answerType: "image", answerImage: imgUrl });
                subIndex++;
                j += 4;
              } else {
                j++;
              }
            } else if (t.toLowerCase() === "image") {
              const q = lines[j + 1] || "";
              const url = lines[j + 2] || "";
              subs.push({ part: parseNumberToLetter(subIndex), text: q, answerType: "image", answerImage: url });
              subIndex++;
              j += 3;
            } else {
              j++;
            }
          }
          parents.push({ id: undefined, year, part, question_text: qText, sub_questions: subs });
          i = j;
          continue;
        }
        if (token.toLowerCase() === "image") {
          const q = lines[i + 1] || "";
          const url = lines[i + 3] || lines[i + 2] || "";
          parents.push({ id: undefined, year, part, question_text: q, sub_questions: [{ part: "a", text: q, answerType: "image", answerImage: url }] });
          i += 4;
          continue;
        }
        i++;
      }
      docs = parents;
    }
    if (overrideYear && partNormalized) {
      const p = normalizePart(partNormalized) || partNormalized;
      await StructuredQuestion.deleteMany({ year: overrideYear, part: p });
    }
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
