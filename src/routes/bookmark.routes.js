import express from "express";
import {
  addBookmark,
  getBookmarks,
  getBookmarkById,
  removeBookmark
} from "../controller/bookmark.js";

import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/add", authenticate, addBookmark);
router.get("/", authenticate, getBookmarks);
router.get("/:qid", authenticate, getBookmarkById);
router.delete("/:qid", authenticate, removeBookmark);

export default router;
