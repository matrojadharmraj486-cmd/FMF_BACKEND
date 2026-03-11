import Qotd from "../models/Qotd.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const origin = `${req.protocol}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const sanitizeHTML = (html) => {
  const s = String(html || "");
  return s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
};

export const upsertQotd = async (req, res) => {
  try {
    const { question, answerType } = req.body;
    if (!question || !answerType)
      return res.status(400).json({ status: 400, message: "question and answerType required" });
    if (!["text", "image"].includes(answerType))
      return res.status(400).json({ status: 400, message: "answerType must be 'text' or 'image'" });

    const today = new Date().toISOString().slice(0, 10);
    let payload = { question: sanitizeHTML(question), answerType, isActive: true, date: today };
    if (answerType === "text") {
      const answer = req.body.answer ?? req.body.answerText;
      if (!answer) return res.status(400).json({ status: 400, message: "answer required for text type" });
      payload.answerText = sanitizeHTML(answer);
    } else {
      const url = req.file ? `/uploads/${req.file.filename}` : (req.body.answerImageUrl || "").trim();
      if (!url)
        return res.status(400).json({
          status: 400,
          message: "answerImageUrl or answerImage file required for image type"
        });
      payload.answerImage = url;
    }

    await Qotd.updateMany({ isActive: true }, { $set: { isActive: false } });
    const existingToday = await Qotd.findOne({ date: today });
    let doc;
    if (existingToday) {
      doc = await Qotd.findByIdAndUpdate(existingToday._id, payload, { new: true });
    } else {
      doc = await Qotd.create(payload);
    }
    return res.status(201).json({
      status: 201,
      message: "QOTD set",
      question: doc.question,
      answerType: doc.answerType,
      answer: doc.answerType === "text" ? doc.answerText : undefined,
      answerImageUrl: doc.answerType === "image" ? toAbsolute(doc.answerImage, req) : undefined
    });
  } catch (e) {
    return res.status(500).json({ status: 500, message: e.message });
  }
};

export const getActiveQotd = async (req, res) => {
  try {
    const doc = await Qotd.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (!doc) {
      return res.status(200).json({
        status: 200,
        message: "QOTD fetched",
        question: null,
        answerType: null,
        answer: null,
        answerImageUrl: null
      });
    }
    return res.status(200).json({
      status: 200,
      message: "QOTD fetched",
      question: doc.question,
      answerType: doc.answerType,
      answer: doc.answerType === "text" ? doc.answerText : undefined,
      answerImageUrl: doc.answerType === "image" ? toAbsolute(doc.answerImage, req) : undefined
    });
  } catch (e) {
    return res.status(500).json({ status: 500, message: e.message });
  }
};

export const updateQotd = async (req, res) => {
  try {
    const { question, answerType } = req.body;
    if (!question || !answerType)
      return res.status(400).json({ status: 400, message: "question and answerType required" });
    if (!["text", "image"].includes(answerType))
      return res.status(400).json({ status: 400, message: "answerType must be 'text' or 'image'" });
    const today = new Date().toISOString().slice(0, 10);
    const doc = await Qotd.findOne({ date: today }) || await Qotd.findOne({ isActive: true });
    if (!doc) return res.status(404).json({ status: 404, message: "No active QOTD to update" });
    doc.question = sanitizeHTML(question);
    doc.answerType = answerType;
    if (answerType === "text") {
      const answer = req.body.answer ?? req.body.answerText;
      if (!answer) return res.status(400).json({ status: 400, message: "answer required for text type" });
      doc.answerText = sanitizeHTML(answer);
      doc.answerImage = undefined;
    } else {
      const url = req.file ? `/uploads/${req.file.filename}` : (req.body.answerImageUrl || "").trim();
      if (!url)
        return res.status(400).json({
          status: 400,
          message: "answerImageUrl or answerImage file required for image type"
        });
      doc.answerImage = url;
      doc.answerText = undefined;
    }
    await doc.save();
    return res.status(200).json({
      status: 200,
      message: "QOTD updated",
      question: doc.question,
      answerType: doc.answerType,
      answer: doc.answerType === "text" ? doc.answerText : undefined,
      answerImageUrl: doc.answerType === "image" ? toAbsolute(doc.answerImage, req) : undefined
    });
  } catch (e) {
    return res.status(500).json({ status: 500, message: e.message });
  }
};
