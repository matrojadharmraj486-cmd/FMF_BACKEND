import Question from "../models/Question.js";
import { successResponse, errorResponse } from "../utils/response.js";
import xlsx from "xlsx";
import { logger } from "../utils/logger.js";

export const createQuestion = async (req, res) => {
  try {
    const { year, part, question, answerType, answerText, answerBlocks } = req.body;
    if (!year || !part || !question || !answerType)
      return errorResponse(res, 400, "year, part, question, answerType required");
    if (!["text", "image", "rich"].includes(String(answerType).toLowerCase()))
      return errorResponse(res, 400, "answerType must be 'text', 'image' or 'rich'");
    let doc = null;
    const normalizedType = String(answerType).toLowerCase();
    if (normalizedType === "text") {
      if (!answerText) return errorResponse(res, 400, "answerText required for text type");
      doc = await Question.create({ year, part, question, answerType, answerText });
    } else if (normalizedType === "image") {
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
      if (!fileUrl) return errorResponse(res, 400, "answerImage file required for image type");
      doc = await Question.create({ year, part, question, answerType, answerImage: fileUrl });
    } else {
      const blocks = Array.isArray(answerBlocks) ? answerBlocks : [];
      const normalized = blocks
        .filter(b => b && typeof b === "object")
        .map(b => ({
          type: String(b.type || "").trim().toLowerCase(),
          text: b.text,
          url: b.url,
          alt: b.alt
        }))
        .filter(b => (b.type === "text" && String(b.text || "").trim()) || (b.type === "image" && String(b.url || "").trim()))
        .map(b => (b.type === "text"
          ? { type: "text", text: String(b.text || "").trim() }
          : { type: "image", url: String(b.url || "").trim(), ...(String(b.alt || "").trim() ? { alt: String(b.alt || "").trim() } : {}) }));
      if (!normalized.length) return errorResponse(res, 400, "answerBlocks required for rich type");
      doc = await Question.create({ year, part, question, answerType: "rich", answerBlocks: normalized });
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
      if (obj.answerType === "rich" && Array.isArray(obj.answerBlocks)) {
        obj.answerBlocks = obj.answerBlocks.map((b) => {
          if (b?.type === "image" && b.url && !String(b.url).startsWith("http")) {
            return { ...b, url: `${origin}${b.url}` };
          }
          return b;
        });
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
    if (payload.answerType && !["text", "image", "rich"].includes(String(payload.answerType).toLowerCase()))
      return errorResponse(res, 400, "answerType must be 'text', 'image' or 'rich'");

    if (payload.answerType) payload.answerType = String(payload.answerType).toLowerCase();
    if (payload.answerType === "rich") {
      const blocks = Array.isArray(payload.answerBlocks) ? payload.answerBlocks : [];
      const normalized = blocks
        .filter(b => b && typeof b === "object")
        .map(b => ({
          type: String(b.type || "").trim().toLowerCase(),
          text: b.text,
          url: b.url,
          alt: b.alt
        }))
        .filter(b => (b.type === "text" && String(b.text || "").trim()) || (b.type === "image" && String(b.url || "").trim()))
        .map(b => (b.type === "text"
          ? { type: "text", text: String(b.text || "").trim() }
          : { type: "image", url: String(b.url || "").trim(), ...(String(b.alt || "").trim() ? { alt: String(b.alt || "").trim() } : {}) }));
      if (!normalized.length) return errorResponse(res, 400, "answerBlocks required for rich type");
      payload.answerBlocks = normalized;
      payload.answerText = undefined;
      payload.answerImage = undefined;
    } else if (payload.answerType === "text") {
      payload.answerImage = undefined;
      payload.answerBlocks = [];
    } else if (payload.answerType === "image") {
      payload.answerText = undefined;
      payload.answerBlocks = [];
    }
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

    logger.info("Question Excel upload started", {
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
    logger.info("Question Excel parsed", {
      fileName: req.file.originalname,
      sheetName: wsName,
      rowCount: rows.length
    });

    if (!rows.length) {
      logger.warn("Question Excel upload rejected because file is empty", {
        fileName: req.file.originalname,
        adminId: req.user?._id
      });
      return errorResponse(res, 400, "file is empty");
    }

    const docs = [];
    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      const rowNumber = index + 2;
      const year = overrideYear ?? Number(r.year);
      const part = overridePart ?? String(r.part || "").trim();
      const question = String(r.question || "").trim();
      const answerType = String(r.answerType || "").trim().toLowerCase();
      const answerText = String(r.answerText || "").trim();
      const answerImage = String(r.answerImage || "").trim();
      if (!year || !part || !question || !answerType) {
        logger.warn("Question Excel row validation failed", {
          rowNumber,
          reason: "year, part, question, answerType required",
          row: r
        });
        return errorResponse(res, 400, "year, part, question, answerType required in each row or via form fields");
      }
      if (!["text", "image"].includes(answerType)) {
        logger.warn("Question Excel row validation failed", {
          rowNumber,
          reason: "invalid answerType",
          answerType,
          row: r
        });
        return errorResponse(res, 400, "answerType must be 'text' or 'image'");
      }
      if (answerType === "text" && !answerText) {
        logger.warn("Question Excel row validation failed", {
          rowNumber,
          reason: "answerText required for text row",
          row: r
        });
        return errorResponse(res, 400, "answerText required for text rows");
      }
      if (answerType === "image" && !answerImage) {
        logger.warn("Question Excel row validation failed", {
          rowNumber,
          reason: "answerImage required for image row",
          row: r
        });
        return errorResponse(res, 400, "answerImage required for image rows");
      }
      const payload = { year, part, question, answerType };
      if (answerType === "text") payload.answerText = answerText;
      else payload.answerImage = answerImage.startsWith("/") ? answerImage : `/uploads/${answerImage}`;
      docs.push(payload);
    }
    const inserted = await Question.insertMany(docs);
    logger.info("Question Excel upload completed", {
      fileName: req.file.originalname,
      insertedCount: inserted.length,
      adminId: req.user?._id
    });
    return successResponse(res, 201, "Questions uploaded", { inserted: inserted.length });
  } catch (e) {
    logger.error("Question Excel upload failed", {
      fileName: req.file?.originalname,
      path: req.file?.path,
      adminId: req.user?._id,
      error: e.message,
      stack: e.stack
    });
    return errorResponse(res, 500, e.message);
  }
};
