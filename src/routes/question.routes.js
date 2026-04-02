import express from "express";
import {
  getStructuredQuestions,
  searchStructuredQuestions,
  listStructuredYears,
  listStructuredParts,
  listStructuredPapers
} from "../controllers/structured.question.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public: returns exact shape like data/questions.json
router.get("/questions", getStructuredQuestions);
router.get("/questions/search", authenticate, searchStructuredQuestions);
router.get("/questions/years", authenticate, listStructuredYears);
router.get("/questions/parts", authenticate, listStructuredParts);
router.get("/questions/papers", authenticate, listStructuredPapers);

export default router;
