import express from "express";
import { getStructuredQuestions } from "../controllers/structured.question.controller.js";

const router = express.Router();

// Public: returns exact shape like data/questions.json
router.get("/questions", getStructuredQuestions);

export default router;
