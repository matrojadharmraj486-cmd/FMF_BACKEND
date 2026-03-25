import xlsx from "xlsx";
import StructuredQuestion from "../models/StructuredQuestion.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

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

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const parseBoolean = (value) => {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return undefined;
};

const normalizeQuestionType = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  return v;
};

const withComputedAnswer = (obj) => {
  const subs = Array.isArray(obj.sub_questions) ? obj.sub_questions : [];
  const inferredDirect =
    subs.length === 1 &&
    String(subs[0].part || "").toLowerCase() === "a" &&
    String(subs[0].text || "").trim() === String(obj.question_text || "").trim();
  if (!obj.isDirect && !inferredDirect) return obj;
  const sq = subs[0];
  if (!sq) return obj;
  obj.answerType = sq.answerType;
  if (sq.answerType === "text") {
    obj.answer = sq.answer;
  } else if (sq.answerType === "image") {
    obj.answerImage = sq.answerImage;
  }
  obj.sub_questions = [];
  return obj;
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
    const data = docs.map((d, index) => {
      const obj = d.toObject();
      obj.id = obj.id || String(obj._id);
      const fallbackQuestionId = `Q${index + 1}`;
      obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : fallbackQuestionId;
      obj.sub_questions = (obj.sub_questions || []).map(sq => {
        if (sq.answerType === "image" && sq.answerImage) {
          sq.answerImage = toAbsolute(sq.answerImage, req);
        }
        return sq;
      });
      return withComputedAnswer(obj);
    });
    return successResponse(res, 200, "Questions fetched successfully", {
      total: data.length,
      questions: data
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const createStructuredQuestion = async (req, res) => {
  try {
    const {
      year,
      part,
      question_text,
      sub_questions,
      id,
      QOTD,
      isDirect,
      main_question_answer
    } = req.body || {};

    if (year === undefined || year === null || year === "") {
      return errorResponse(res, 400, "year required");
    }
    const parsedYear = Number(year);
    if (!Number.isFinite(parsedYear)) {
      return errorResponse(res, 400, "year must be a number");
    }

    if (!part || !String(part).trim()) {
      return errorResponse(res, 400, "part required");
    }
    const parsedPart = normalizePart(part);
    if (!parsedPart || !["Part 1", "Part 2"].includes(parsedPart)) {
      return errorResponse(res, 400, "part must be 'Part 1' or 'Part 2'");
    }

    if (!question_text || !String(question_text).trim()) {
      return errorResponse(res, 400, "question_text required");
    }

    if (!Array.isArray(sub_questions) || sub_questions.length < 1) {
      return errorResponse(res, 400, "sub_questions required with at least 1 item");
    }

    const normalizedSubs = [];
    for (let i = 0; i < sub_questions.length; i++) {
      const sq = sub_questions[i] || {};
      const row = i + 1;

      const sqPart = String(sq.part || "").trim();
      const sqText = String(sq.text || "").trim();
      const rawType = String(sq.answerType || "").trim().toLowerCase();

      if (!sqPart || !sqText || !rawType) {
        return errorResponse(res, 400, `sub_questions[${row}] part, text, answerType required`);
      }
      if (!["text", "image"].includes(rawType)) {
        return errorResponse(res, 400, `sub_questions[${row}] answerType must be 'text' or 'image'`);
      }

      if (rawType === "text") {
        if (!Array.isArray(sq.answer) || sq.answer.length === 0) {
          return errorResponse(res, 400, `sub_questions[${row}] answer array required for answerType=text`);
        }
        const ans = sq.answer.map(a => String(a || "").trim()).filter(Boolean);
        if (!ans.length) {
          return errorResponse(res, 400, `sub_questions[${row}] answer array must contain non-empty values`);
        }
        normalizedSubs.push({
          part: sqPart,
          text: sqText,
          answerType: "text",
          answer: ans
        });
      } else {
        const img = String(sq.answerImage || "").trim();
        if (!img) {
          return errorResponse(res, 400, `sub_questions[${row}] answerImage required for answerType=image`);
        }
        normalizedSubs.push({
          part: sqPart,
          text: sqText,
          answerType: "image",
          answer: [],
          answerImage: (img.startsWith("http") || img.startsWith("/uploads/")) ? img : `/uploads/${img}`
        });
      }
    }

    const payload = {
      year: parsedYear,
      part: parsedPart,
      question_text: String(question_text).trim(),
      sub_questions: normalizedSubs
    };
    if (main_question_answer !== undefined) {
      const arr = Array.isArray(main_question_answer)
        ? main_question_answer
        : String(main_question_answer).split(";");
      const cleaned = arr.map(a => String(a || "").trim()).filter(Boolean);
      if (cleaned.length) payload.main_question_answer = cleaned;
    }
    if (isDirect !== undefined) {
      const parsedDirect = parseBoolean(isDirect);
      if (parsedDirect === undefined) {
        return errorResponse(res, 400, "isDirect must be boolean");
      }
      payload.isDirect = parsedDirect;
    }
    if (id !== undefined && id !== null && String(id).trim()) {
      payload.id = String(id).trim();
    }
    if (QOTD !== undefined) {
      const parsedQotd = parseBoolean(QOTD);
      if (parsedQotd === undefined) {
        return errorResponse(res, 400, "QOTD must be boolean");
      }
      payload.QOTD = parsedQotd;
    }

    const created = await StructuredQuestion.create(payload);
    const obj = created.toObject();
    obj.id = obj.id || String(obj._id);
    obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : undefined;
    obj.sub_questions = (obj.sub_questions || []).map(sq => {
      if (sq.answerType === "image" && sq.answerImage) {
        sq.answerImage = toAbsolute(sq.answerImage, req);
      }
      return sq;
    });

    return res.status(201).json({
      success: true,
      data: withComputedAnswer(obj)
    });
  } catch (e) {
    return errorResponse(res, 500, e.message || "Internal server error");
  }
};

export const uploadStructuredExcel = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "file required");
    const overrideYear = req.body.year ? Number(req.body.year) : undefined;
    const overridePart = normalizePart(req.body.part) || req.body.part;

    logger.info("Structured question upload started", {
      fileName: req.file.originalname,
      storedFileName: req.file.filename,
      path: req.file.path,
      overrideYear,
      overridePart,
      adminId: req.user?._id
    });

    const wb = xlsx.readFile(req.file.path);
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
    logger.info("Structured question file parsed", {
      fileName: req.file.originalname,
      sheetName: wsName,
      rowCount: rows.length
    });
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
      questionType: ["question_type", "questiontype", "quetion_type", "question_type_1", "type"],
      subQuestionType: ["question_type_1", "sub_question_type", "subquestion_type", "sub_type"],
      answerType: ["answerType", "answer_type", "response_type", "format"],
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
      if (!rows.length) {
        logger.warn("Structured question upload rejected because file is empty", {
          fileName: req.file.originalname,
          adminId: req.user?._id
        });
        return errorResponse(res, 400, "file is empty");
      }
      const groups = new Map();
      for (let index = 0; index < rows.length; index++) {
        const r = rows[index];
        const rowNumber = index + 2;
        const groupId = String(pickValue(r, aliases.groupId) || "").trim();
        const year = (overrideYear ?? Number(pickValue(r, aliases.year))) || new Date().getFullYear();
        const rawPart = pickValue(r, aliases.part);
        const partCandidate = partNormalized ?? (normalizePart(rawPart) || String(rawPart || "").trim() || "Part 1");
        const part = normalizePart(partCandidate) || partCandidate;
        const question_text = String(pickValue(r, aliases.questionText) || "").trim();
        const mainQuestionAnswer = String(pickValue(r, aliases.mainQuestionAnswer) || "").trim();
        const subPartRaw = String(pickValue(r, aliases.subPart) || "").trim();
        const subTextRaw = String(pickValue(r, aliases.subText) || "").trim();
        const rawQuestionType = normalizeQuestionType(pickValue(r, aliases.questionType));
        const isDirectType = ["answer", "ans", "direct", "single", "image"].includes(rawQuestionType);
        const rawSubQuestionType = normalizeQuestionType(pickValue(r, aliases.subQuestionType));
        const rawAnswerType = String(pickValue(r, aliases.answerType) || "").trim().toLowerCase();
        const isDirectRow = isDirectType || (!subPartRaw && !subTextRaw);
        const resolvedTypeToken = isDirectRow
          ? (rawQuestionType || rawAnswerType || "text")
          : (rawSubQuestionType || rawAnswerType || "text");
        const answerType = ["image", "img", "photo", "figure"].includes(resolvedTypeToken) ? "image" : "text";
        let answerText = String(pickValue(r, aliases.answerText) || "").trim();
        const answerImage = String(pickValue(r, aliases.answerImage) || "").trim();
        const sub_part = isDirectRow ? "a" : parseSubPartFromToken(subPartRaw, "a");
        const sub_text = isDirectRow ? question_text : subTextRaw;
        if (isDirectRow && !answerText && mainQuestionAnswer) answerText = mainQuestionAnswer;
        if (!year || !question_text || !sub_part || !sub_text) {
          logger.warn("Structured question row validation failed", {
            rowNumber,
            reason: "year, part, question_text, sub_part, sub_text required",
            row: r
          });
          return errorResponse(res, 400, "year, part, question_text, sub_part, sub_text required");
        }
        if (!["Part 1", "Part 2"].includes(part)) {
          logger.warn("Structured question row validation failed", {
            rowNumber,
            reason: "invalid part",
            part,
            row: r
          });
          return errorResponse(res, 400, "part must be 'Part 1' or 'Part 2'");
        }
        if (!["text", "image"].includes(answerType)) {
          logger.warn("Structured question row validation failed", {
            rowNumber,
            reason: "invalid answerType",
            answerType,
            row: r
          });
          return errorResponse(res, 400, "answerType must be 'text' or 'image'");
        }
        const key = groupId || `${year}-${part}-${question_text}`;
        if (!groups.has(key)) {
          groups.set(key, {
            id: groupId || undefined,
            year,
            part,
            question_text,
            isDirect: isDirectRow,
            main_question_answer: [],
            sub_questions: []
          });
        }
        const group = groups.get(key);
        if (isDirectRow) group.isDirect = true;
        if (mainQuestionAnswer) {
          const mainAns = mainQuestionAnswer.split(";").map(s => s.trim()).filter(Boolean);
          if (mainAns.length) group.main_question_answer = mainAns;
        }
        const sub = { part: sub_part, text: sub_text, answerType };
        if (answerType === "text") {
          sub.answer = answerText ? answerText.split(";").map(s => s.trim()).filter(Boolean) : [];
        } else {
          sub.answerImage = answerImage.startsWith("http") || answerImage.startsWith("/uploads/")
            ? answerImage
            : `/uploads/${answerImage}`;
        }
        group.sub_questions.push(sub);
      }
      docs = Array.from(groups.values());
    } else {
      const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });
      const lines = raw.flat().map(v => String(v || "").trim()).filter(v => v.length > 0);
      const year = overrideYear;
      const part = normalizePart(partNormalized) || partNormalized;
      if (!year || !part) {
        logger.warn("Structured legacy upload rejected because year or part is missing", {
          fileName: req.file.originalname,
          overrideYear,
          overridePart
        });
        return errorResponse(res, 400, "year and part required");
      }
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
            isDirect: true,
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
          parents.push({ id: undefined, year, part, question_text: qText, isDirect: false, sub_questions: subs });
          i = j;
          continue;
        }
        if (token.toLowerCase() === "image") {
          const q = lines[i + 1] || "";
          const url = lines[i + 3] || lines[i + 2] || "";
          parents.push({ id: undefined, year, part, question_text: q, isDirect: true, sub_questions: [{ part: "a", text: q, answerType: "image", answerImage: url }] });
          i += 4;
          continue;
        }
        i++;
      }
      docs = parents;
    }
    if (overrideYear && partNormalized) {
      const p = normalizePart(partNormalized) || partNormalized;
      logger.info("Structured question upload replacing existing questions", {
        year: overrideYear,
        part: p,
        adminId: req.user?._id
      });
      await StructuredQuestion.deleteMany({ year: overrideYear, part: p });
    }
    const inserted = await StructuredQuestion.insertMany(docs);
    logger.info("Structured question upload completed", {
      fileName: req.file.originalname,
      insertedCount: inserted.length,
      parsedDocCount: docs.length,
      adminId: req.user?._id
    });
    return successResponse(res, 201, "Structured questions uploaded", { inserted: inserted.length });
  } catch (e) {
    logger.error("Structured question upload failed", {
      fileName: req.file?.originalname,
      path: req.file?.path,
      adminId: req.user?._id,
      error: e.message,
      stack: e.stack
    });
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
    const data = docs.map((d, index) => {
      const obj = d.toObject();
      obj.id = obj.id || String(obj._id);
      const fallbackQuestionId = `Q${index + 1}`;
      obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : fallbackQuestionId;
      obj.sub_questions = (obj.sub_questions || []).map(sq => {
        if (sq.answerType === "image" && sq.answerImage) {
          sq.answerImage = toAbsolute(sq.answerImage, req);
        }
        return sq;
      });
      return withComputedAnswer(obj);
    });
    return successResponse(res, 200, "Admin questions fetched", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const searchStructuredQuestions = async (req, res) => {
  try {
    const { year, part, search } = req.query;
    if (year === undefined || year === null || year === "") {
      return errorResponse(res, 400, "year required");
    }
    const parsedYear = Number(year);
    if (!Number.isFinite(parsedYear)) {
      return errorResponse(res, 400, "year must be a number");
    }
    if (!search || !String(search).trim()) {
      return errorResponse(res, 400, "search required");
    }

    const filter = { year: parsedYear };
    if (part) {
      const p = normalizePart(part) || part;
      filter.part = p;
    }

    const safe = escapeRegex(search.trim());
    const regex = new RegExp(safe, "i");
    filter.$or = [
      { question_text: regex },
      { "sub_questions.text": regex },
      { main_question_answer: regex }
    ];

    const docs = await StructuredQuestion.find(filter).sort({ year: -1, part: 1, createdAt: -1 });
    const data = docs.map((d, index) => {
      const obj = d.toObject();
      obj.id = obj.id || String(obj._id);
      const fallbackQuestionId = `Q${index + 1}`;
      obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : fallbackQuestionId;
      obj.sub_questions = (obj.sub_questions || []).map(sq => {
        if (sq.answerType === "image" && sq.answerImage) {
          sq.answerImage = toAbsolute(sq.answerImage, req);
        }
        return sq;
      });
      return withComputedAnswer(obj);
    });

    return successResponse(res, 200, "Search results fetched", {
      total: data.length,
      questions: data
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getStructuredQotdQuestions = async (req, res) => {
  try {
    const docs = await StructuredQuestion.find({ QOTD: true }).sort({ year: -1, part: 1, createdAt: -1 });
    const data = docs.map((d, index) => {
      const obj = d.toObject();
      obj.id = obj.id || String(obj._id);
      const fallbackQuestionId = `Q${index + 1}`;
      obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : fallbackQuestionId;
      obj.sub_questions = (obj.sub_questions || []).map(sq => {
        if (sq.answerType === "image" && sq.answerImage) {
          sq.answerImage = toAbsolute(sq.answerImage, req);
        }
        return sq;
      });
      return withComputedAnswer(obj);
    });
    return successResponse(res, 200, "QOTD questions fetched", {
      total: data.length,
      questions: data
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateStructuredQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(payload, "QOTD")) {
      const parsedQotd = parseBoolean(payload.QOTD);
      if (parsedQotd === undefined) {
        return errorResponse(res, 400, "QOTD must be boolean");
      }
      payload.QOTD = parsedQotd;
    }
    const doc = await StructuredQuestion.findByIdAndUpdate(id, payload, { new: true });
    if (!doc) return errorResponse(res, 404, "Question not found");
    return successResponse(res, 200, "Question updated", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const clearStructuredQotdFlags = async (req, res) => {
  try {
    const result = await StructuredQuestion.updateMany({ QOTD: true }, { $set: { QOTD: false } });
    return successResponse(res, 200, "QOTD flags cleared", { modified: result.modifiedCount || 0 });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const setActiveStructuredQotd = async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await StructuredQuestion.findById(id);
    if (!exists) return errorResponse(res, 404, "Question not found");
    await StructuredQuestion.updateMany({ QOTD: true }, { $set: { QOTD: false } });
    const doc = await StructuredQuestion.findByIdAndUpdate(id, { QOTD: true }, { new: true });
    return successResponse(res, 200, "QOTD set", doc);
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
