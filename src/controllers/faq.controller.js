import Faq from "../models/Faq.js";
import { successResponse, errorResponse } from "../utils/response.js";

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const sortPipeline = (match) => [
  { $match: match || {} },
  { $addFields: { _orderSort: { $ifNull: ["$order", 2147483647] } } },
  { $sort: { _orderSort: 1, createdAt: -1 } },
  { $project: { _orderSort: 0 } }
];

const htmlToText = (html) => {
  const input = String(html || "");
  if (!input) return "";
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const listFaqsAdmin = async (req, res) => {
  try {
    const docs = await Faq.aggregate(sortPipeline({}));
    return successResponse(res, 200, "Faqs fetched", docs);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const createFaq = async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();
    const answer = String(req.body?.answer || "").trim();
    if (!question) return errorResponse(res, 400, "question required");
    if (!answer) return errorResponse(res, 400, "answer required");

    const order = parseOptionalNumber(req.body?.order);
    if (Number.isNaN(order)) return errorResponse(res, 400, "order must be a number");

    const payload = {
      question,
      answer,
      isActive: Object.prototype.hasOwnProperty.call(req.body, "isActive")
        ? Boolean(req.body.isActive)
        : true
    };
    if (order !== undefined) payload.order = order;

    const doc = await Faq.create(payload);
    return successResponse(res, 201, "Faq created", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Faq.findById(id);
    if (!doc) return errorResponse(res, 404, "Faq not found");

    if (Object.prototype.hasOwnProperty.call(req.body, "question")) {
      const question = String(req.body.question || "").trim();
      if (!question) return errorResponse(res, 400, "question cannot be empty");
      doc.question = question;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "answer")) {
      const answer = String(req.body.answer || "").trim();
      if (!answer) return errorResponse(res, 400, "answer cannot be empty");
      doc.answer = answer;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      doc.isActive = Boolean(req.body.isActive);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "order")) {
      const order = parseOptionalNumber(req.body.order);
      if (Number.isNaN(order)) return errorResponse(res, 400, "order must be a number");
      doc.order = order;
    }

    await doc.save();
    return successResponse(res, 200, "Faq updated", doc);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Faq.findByIdAndDelete(id);
    if (!doc) return errorResponse(res, 404, "Faq not found");
    return successResponse(res, 200, "Faq deleted");
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const listFaqsPublic = async (req, res) => {
  try {
    const docs = await Faq.aggregate(sortPipeline({ isActive: true }));
    const data = docs.map((d) => ({
      ...d,
      answer: htmlToText(d.answer)
    }));
    return successResponse(res, 200, "Faqs fetched", data);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
