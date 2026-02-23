import express from "express";
import { getQuestions } from "../controllers/admin.question.controller.js";

const router = express.Router();

// Public: supports ?year=&part=
router.get("/questions", getQuestions);

export default router;
