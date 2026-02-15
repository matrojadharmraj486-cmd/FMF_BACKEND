import Bookmark from "../models/BookMark.js";
import { successResponse, errorResponse } from "../utils/response.js";


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

  const { collectionId } = req.params;
  const { question } = req.body;

  const bookmark = await Bookmark.findById(collectionId);

  if (!bookmark)
    return errorResponse(res, 404, "Collection not found");

  // prevent duplicate
  const exists = bookmark.questions.find(q => q.id === question.id);

  if (exists)
    return errorResponse(res, 400, "Already bookmarked");

  bookmark.questions.push(question);

  await bookmark.save();

  return successResponse(res, 200, "Question added");
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

  return successResponse(res, 200, "Status", {
    bookmarked: collections.length > 0,
    collections
  });

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
