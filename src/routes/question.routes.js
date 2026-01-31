import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* resolve __dirname */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* load questions.json */
const questionsPath = path.join(__dirname, "../data/questions.json");
const questions = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));

router.get("/questions", authenticate, (req, res) => {
  res.status(200).json({
    status: 200,
    message: "Questions fetched successfully",
    data: {
      total: questions.length,
      questions
    }
  });
});

export default router;
