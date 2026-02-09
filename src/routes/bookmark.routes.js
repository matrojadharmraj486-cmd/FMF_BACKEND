import express from "express";
import {
  createBookmark,
  updateBookmark,
  getBookmarks,
  addQuestionToBookmark
} from "../controller/bookmark.js";

import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createBookmark);
router.put("/:id", updateBookmark);
router.get("/", getBookmarks);
router.post("/:id/add-question", addQuestionToBookmark);

export default router;
