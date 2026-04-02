import express from "express";
import {
  getStructuredQuestions,
  searchStructuredQuestions,
  listStructuredYears,
  listStructuredParts,
  listStructuredPapers
} from "../controllers/structured.question.controller.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";

const router = express.Router();

// Public: returns exact shape like data/questions.json
router.get("/questions", getStructuredQuestions);
router.get("/questions/search", authenticate, searchStructuredQuestions);
router.get("/questions/years", optionalAuthenticate, listStructuredYears);
router.get("/questions/parts", optionalAuthenticate, listStructuredParts);
router.get("/questions/papers", optionalAuthenticate, listStructuredPapers);

export default router;
