import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { upsertQotd, getActiveQotd } from "../controllers/qotd.controller.js";

const router = express.Router();

// Admin
router.post("/question-of-the-day", adminAuthenticate, upload.single("answerImage"), upsertQotd);

// Public
router.get("/question-of-the-day", getActiveQotd);

export default router;
