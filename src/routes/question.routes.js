import express from "express";
import { getStructuredQuestions, searchStructuredQuestions } from "../controllers/structured.question.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public: returns exact shape like data/questions.json
router.get("/questions", getStructuredQuestions);
router.get("/questions/search", authenticate, searchStructuredQuestions);

export default router;
