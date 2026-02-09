import Bookmark from "../models/BookMark";

/* Create */
export const createBookmark = async (req, res) => {
  const bookmark = await Bookmark.create({
    userId: req.user._id,
    name: req.body.name
  });

  return successResponse(res, 201, "Bookmark created", bookmark);
};

/* Update */
export const updateBookmark = async (req, res) => {
  const bookmark = await Bookmark.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name },
    { new: true }
  );

  return successResponse(res, 200, "Bookmark updated", bookmark);
};

export const getBookmarks = async (req, res) => {
  const bookmarks = await Bookmark.find({
    userId: req.user._id
  });

  return successResponse(
    res,
    200,
    "Bookmarks fetched",
    bookmarks
  );
};

export const addQuestionToBookmark = async (req, res) => {
  const { questionId } = req.body;

  const bookmark = await Bookmark.findById(req.params.id);

  if (!bookmark)
    return errorResponse(res, 404, "Bookmark not found");

  if (!bookmark.questions.includes(questionId)) {
    bookmark.questions.push(questionId);
    await bookmark.save();
  }

  return successResponse(
    res,
    200,
    "Question added to bookmark",
    bookmark
  );
};

