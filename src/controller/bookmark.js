import Bookmark from "../models/BookMark.js";
import { errorResponse } from "../utils/response.js";
import { successResponse } from "../utils/response.js";

export const addBookmark = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = req.body.question;

    let bookmark = await Bookmark.findOne({ user: userId });

    if (!bookmark) {
      bookmark = new Bookmark({
        user: userId,
        questions: [question]
      });
    } else {
      const exists = bookmark.questions.find(
        (q) => q.id === question.id
      );

      if (exists) {
        return errorResponse(res, 400, "Already bookmarked");
      }

      bookmark.questions.push(question);
    }

    await bookmark.save();

    return successResponse(res, 200, "Bookmark added", bookmark);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};


export const getBookmarkById = async (req, res) => {
  const { qid } = req.params;

  const bookmark = await Bookmark.findOne({ user: req.user.id });

  if (!bookmark) {
    return errorResponse(res, 404, "No bookmark found");
  }

  const question = bookmark.questions.find(
    (q) => q.id === qid
  );

  if (!question) {
    return errorResponse(res, 404, "Question not found");
  }

  return successResponse(res, 200, "Question found", question);
};


export const getBookmarks = async (req, res) => {
  const bookmark = await Bookmark.findOne({ user: req.user.id });

  if (!bookmark) {
    return successResponse(res, 200, "No bookmarks", []);
  }

  return successResponse(res, 200, "Bookmarks fetched", bookmark.questions);
};


export const removeBookmark = async (req, res) => {
  const { qid } = req.params;

  const bookmark = await Bookmark.findOne({ user: req.user.id });

  if (!bookmark) {
    return errorResponse(res, 404, "No bookmark found");
  }

  bookmark.questions = bookmark.questions.filter(
    (q) => q.id !== qid
  );

  await bookmark.save();

  return successResponse(res, 200, "Removed successfully");
};



