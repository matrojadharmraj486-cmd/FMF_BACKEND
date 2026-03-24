import Bookmark from "../models/BookMark.js";
import StructuredQuestion from "../models/StructuredQuestion.js";
import mongoose from "mongoose";
import { successResponse, errorResponse } from "../utils/response.js";
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

const normalizeStructuredQuestion = (doc, req) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj.id || String(obj._id);
  obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : undefined;
  obj.sub_questions = (obj.sub_questions || []).map(sq => {
    if (sq.answerType === "image" && sq.answerImage) {
      sq.answerImage = toAbsolute(sq.answerImage, req);
    }
    return sq;
  });
  return withComputedAnswer(obj);
};

/* Create Collection */
export const createCollection = async (req, res) => {

  const { name } = req.body;

  const collection = await Bookmark.create({
    user: req.user._id,
    name,
    questions: []
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

  const normalizedQuestion = normalizeStructuredQuestion(questionDoc, req);
  const storedQuestion = {
    id: normalizedQuestion.id,
    question_text: normalizedQuestion.question_text,
    sub_questions: normalizedQuestion.sub_questions
  };

  // prevent duplicate
  const exists = bookmark.questions.find(
    q => String(q.id) === String(storedQuestion.id)
  );

  if (exists)
    return errorResponse(res, 400, "Already bookmarked");

  bookmark.questions.push(storedQuestion);

  await bookmark.save();

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
  const question = normalizeStructuredQuestion(questionDoc, req);

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

  const mapped = new Map();
  for (const d of docs) {
    const normalized = normalizeStructuredQuestion(d, req);
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

  bookmark.questions = bookmark.questions.filter(
    q => q.id !== questionId
  );

  await bookmark.save();

  return successResponse(res, 200, "Removed");
};

export const updateCollection = async (req, res) => {

  const { name } = req.body;

  const bookmark = await Bookmark.findById(req.params.collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  bookmark.name = name;

  await bookmark.save();

  return successResponse(res, 200, "Collection updated");
};


export const deleteCollection = async (req, res) => {

  const bookmark = await Bookmark.findById(req.params.collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  if (bookmark.user.toString() !== req.user._id.toString())
    return errorResponse(res, 403, "Unauthorized");

  await bookmark.deleteOne();

  return successResponse(res, 200, "Collection deleted");
};
