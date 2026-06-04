import Bookmark from "../models/BookMark.js";
import StructuredQuestion from "../models/StructuredQuestion.js";
import mongoose from "mongoose";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";
const toAbsolute = (url, req) => {
  if (!url) return url;
  const origin = `${req.protocol}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
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

const getNumericQuestionId = (value) => {
  const s = String(value || "").trim();
  // Supports "Q12" and ids like "2025-Part 2-Paper 2-Q12"
  const matches = Array.from(s.matchAll(/Q(\d+)/gi));
  if (!matches.length) return null;
  const n = Number(matches[matches.length - 1][1]);
  return Number.isFinite(n) ? n : null;
};

const sortStructuredQuestions = (docs) => {
  const items = docs.map((d, index) => ({ d, index }));
  items.sort((a, b) => {
    const aId = getNumericQuestionId(a.d.id);
    const bId = getNumericQuestionId(b.d.id);
    const aHas = aId !== null;
    const bHas = bId !== null;
    if (aHas && bHas) return aId - bId;
    if (aHas !== bHas) return aHas ? -1 : 1;
    const aTime = a.d.createdAt ? new Date(a.d.createdAt).getTime() : 0;
    const bTime = b.d.createdAt ? new Date(b.d.createdAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.index - b.index;
  });
  return items.map(item => item.d);
};

const normalizeStructuredQuestion = (doc, req, fallbackQuestionId) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj.id || String(obj._id);
  const numericId = getNumericQuestionId(obj.id);
  if (numericId !== null) {
    obj.questionId = `Q${numericId}`;
  } else if (fallbackQuestionId) {
    obj.questionId = fallbackQuestionId;
  } else {
    obj.questionId = obj.id;
  }
  obj.sub_questions = (obj.sub_questions || []).map(sq => {
    if (sq.answerType === "image" && sq.answerImage) {
      sq.answerImage = toAbsolute(sq.answerImage, req);
    }
    return sq;
  });
  return withComputedAnswer(obj);
};

const toStoredQuestion = (questionDoc, req) => {
  const normalizedQuestion = normalizeStructuredQuestion(questionDoc, req);
  if (!normalizedQuestion) return null;

  return {
    id: normalizedQuestion.id,
    question_text: normalizedQuestion.question_text,
    sub_questions: normalizedQuestion.sub_questions
  };
};

const buildFallbackQuestionIdMap = async (docs) => {
  const groups = new Map();
  for (const d of docs) {
    const id = d.id || d._id;
    if (id && getNumericQuestionId(String(id)) !== null) continue;
    const key = `${d.year}||${d.part}||${d.paper || ""}`;
    if (!groups.has(key)) groups.set(key, { year: d.year, part: d.part, paper: d.paper });
  }

  const map = new Map();
  for (const group of groups.values()) {
    const filter = { year: group.year, part: group.part };
    if (group.paper) filter.paper = group.paper;
    const all = await StructuredQuestion.find(
      filter,
      { id: 1, createdAt: 1 }
    );
    const sorted = sortStructuredQuestions(all);
    for (let i = 0; i < sorted.length; i++) {
      map.set(String(sorted[i]._id), `Q${i + 1}`);
    }
  }
  return map;
};

const getQuestionRemovalIds = async (questionId) => {
  const raw = String(questionId || "").trim();
  const ids = new Set(raw ? [raw] : []);
  if (!raw) return ids;

  const filters = [{ id: raw }];
  if (mongoose.Types.ObjectId.isValid(raw)) filters.push({ _id: raw });

  const questionDoc = await StructuredQuestion.findOne({ $or: filters }, { _id: 1, id: 1 }).lean();
  if (questionDoc) {
    ids.add(String(questionDoc._id));
    if (questionDoc.id) ids.add(String(questionDoc.id));
  }

  return ids;
};

/* Create Collection */
export const createCollection = async (req, res) => {

  const name = String(req.body.name || "").trim();

  if (!name)
    return errorResponse(res, 400, "name is required");

  const collection = await Bookmark.create({
    user: req.user._id,
    name,
    questions: []
  });

  logger.info("Bookmark collection created", {
    collectionId: collection._id,
    userId: req.user._id,
    name
  });

  return successResponse(res, 201, "Collection created", collection);
};


/* Get My Collections */
export const getCollections = async (req, res) => {

  const data = await Bookmark.find({ user: req.user._id });

  return successResponse(res, 200, "Collections fetched", data);
};


/* Add Question */
export const addQuestion = async (req, res) => {

  const collectionId =
    req.body.collectionId ||
    req.params.collectionId ||
    req.query.collectionId;
  const questionId =
    req.body.questionId ||
    req.query.questionId;

  if (!collectionId)
    return errorResponse(res, 400, "collectionId is required");

  if (!questionId)
    return errorResponse(res, 400, "questionId is required");

  const bookmark = await Bookmark.findById(collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  const questionDoc = await StructuredQuestion.findOne({
    $or: [{ _id: questionId }, { id: questionId }]
  });

  if (!questionDoc)
    return errorResponse(res, 404, "Question not found");

  const storedQuestion = toStoredQuestion(questionDoc, req);

  // prevent duplicate
  const exists = bookmark.questions.find(
    q => String(q.id) === String(storedQuestion.id)
  );

  if (exists)
    return errorResponse(res, 400, "Already bookmarked");

  bookmark.questions.push(storedQuestion);

  await bookmark.save();

  logger.info("Question added to bookmark collection", {
    collectionId: bookmark._id,
    userId: req.user._id,
    questionId: storedQuestion.id,
    totalQuestions: bookmark.questions.length
  });

  return successResponse(res, 200, "Question added", {
    collectionId: bookmark._id,
    questionId: storedQuestion.id
  });
};


/* Open Collection */
export const getOneCollection = async (req, res) => {

  const data = await Bookmark.findById(req.params.id);

  if (!data)
    return errorResponse(res, 404, "Not found");

  if (data.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  return successResponse(res, 200, "Fetched", data);
};


/* Check Status */
export const checkStatus = async (req, res) => {

  const { questionId } = req.params;

  const collections = await Bookmark.find({
    user: req.user._id,
    "questions.id": questionId
  });

  const questionDoc = await StructuredQuestion.findOne({
    $or: [{ _id: questionId }, { id: questionId }]
  });
  let question = normalizeStructuredQuestion(questionDoc, req);
  if (question && !/^Q\d+$/i.test(String(question.id || ""))) {
    const fallbackMap = await buildFallbackQuestionIdMap([questionDoc]);
    const fallbackId = fallbackMap.get(String(questionDoc._id));
    question = normalizeStructuredQuestion(questionDoc, req, fallbackId);
  }

  return successResponse(res, 200, "Status", {
    bookmarked: collections.length > 0,
    collections,
    question
  });

};

/* Get Questions By Collection */
export const getCollectionQuestions = async (req, res) => {

  const { collectionId } = req.params;

  const bookmark = await Bookmark.findById(collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  const ids = (bookmark.questions || []).map(q => q.id).filter(Boolean);

  if (ids.length === 0) {
    return successResponse(res, 200, "Questions fetched", []);
  }

  const objectIds = ids
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  const docs = await StructuredQuestion.find({
    $or: [
      { _id: { $in: objectIds } },
      { id: { $in: ids } }
    ]
  });

  const fallbackMap = await buildFallbackQuestionIdMap(docs);

  const mapped = new Map();
  for (const d of docs) {
    const fallbackId = fallbackMap.get(String(d._id));
    const normalized = normalizeStructuredQuestion(d, req, fallbackId);
    if (!normalized) continue;
    mapped.set(String(d._id), normalized);
    if (normalized.id) mapped.set(String(normalized.id), normalized);
  }

  const data = ids.map(id => mapped.get(String(id))).filter(Boolean);

  return successResponse(res, 200, "Questions fetched", data);
};

/* Remove Question */
export const removeQuestion = async (req, res) => {

  const { collectionId, questionId } = req.params;

  const bookmark = await Bookmark.findById(collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  const removalIds = await getQuestionRemovalIds(questionId);
  const beforeCount = bookmark.questions.length;

  bookmark.questions = bookmark.questions.filter(q => {
    const storedIds = [
      q.id,
      q._id
    ].map(value => String(value || "")).filter(Boolean);

    return !storedIds.some(id => removalIds.has(id));
  });

  const removedCount = beforeCount - bookmark.questions.length;

  if (removedCount === 0) {
    logger.warn("Bookmark remove requested but no matching question was found", {
      collectionId,
      userId: req.user._id,
      questionId,
      removalIds: Array.from(removalIds),
      totalQuestions: bookmark.questions.length
    });
    return errorResponse(res, 404, "Question not found in collection");
  }

  await bookmark.save();

  logger.info("Question removed from bookmark collection", {
    collectionId,
    userId: req.user._id,
    questionId,
    removedCount,
    totalQuestions: bookmark.questions.length
  });

  return successResponse(res, 200, "Removed", {
    collectionId,
    questionId,
    removedCount,
    totalQuestions: bookmark.questions.length
  });
};

export const updateBookmarkedQuestion = async (req, res) => {

  const { collectionId, questionId } = req.params;
  const nextQuestionId = req.body.newQuestionId || req.body.questionId || questionId;

  if (!nextQuestionId)
    return errorResponse(res, 400, "questionId is required");

  const bookmark = await Bookmark.findById(collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  const existingIndex = bookmark.questions.findIndex(
    q => String(q.id) === String(questionId)
  );

  if (existingIndex === -1)
    return errorResponse(res, 404, "Question not found in collection");

  const duplicateIndex = bookmark.questions.findIndex(
    q => String(q.id) === String(nextQuestionId)
  );

  if (String(nextQuestionId) !== String(questionId) && duplicateIndex !== -1)
    return errorResponse(res, 400, "Question already exists in collection");

  const questionDoc = await StructuredQuestion.findOne({
    $or: [{ _id: nextQuestionId }, { id: nextQuestionId }]
  });

  if (!questionDoc)
    return errorResponse(res, 404, "Question not found");

  bookmark.questions[existingIndex] = toStoredQuestion(questionDoc, req);

  await bookmark.save();

  logger.info("Bookmarked question updated", {
    collectionId: bookmark._id,
    userId: req.user._id,
    previousQuestionId: questionId,
    updatedQuestionId: bookmark.questions[existingIndex].id
  });

  return successResponse(res, 200, "Bookmarked question updated", {
    collectionId: bookmark._id,
    questionId: bookmark.questions[existingIndex].id
  });
};

export const updateCollection = async (req, res) => {

  const name = String(req.body.name || "").trim();

  const bookmark = await Bookmark.findById(req.params.collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  if (!name)
    return errorResponse(res, 400, "name is required");

  bookmark.name = name;

  await bookmark.save();

  logger.info("Bookmark collection renamed", {
    collectionId: bookmark._id,
    userId: req.user._id,
    name
  });

  return successResponse(res, 200, "Collection updated", bookmark);
};


export const deleteCollection = async (req, res) => {

  const bookmark = await Bookmark.findById(req.params.collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  await bookmark.deleteOne();

  logger.info("Bookmark collection deleted", {
    collectionId: req.params.collectionId,
    userId: req.user._id
  });

  return successResponse(res, 200, "Collection deleted");
};
