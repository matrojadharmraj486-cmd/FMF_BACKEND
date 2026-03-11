import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { upsertQotd, updateQotd } from "../controllers/qotd.controller.js";
import { getStructuredQotdQuestions } from "../controllers/structured.question.controller.js";

const router = express.Router();

// Admin
router.post("/question-of-the-day", adminAuthenticate, upload.single("answerImage"), upsertQotd);
router.put("/question-of-the-day", adminAuthenticate, upload.single("answerImage"), updateQotd);

// Public
router.get("/question-of-the-day", getStructuredQotdQuestions);

export default router;
