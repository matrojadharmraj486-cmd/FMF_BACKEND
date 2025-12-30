import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { register, login } from "../controller/authController.js";
import { verifyOtp } from "../controller/otp.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* resolve __dirname in ES module */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* load questions.json */
const questionsPath = path.join(__dirname, "../data/questions.json");
const questions = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);

router.get("/questions", authenticate , (req, res) => {
  res.status(200).json({
    success: true,
    total: questions.length,
    data: questions
  });
});

export default router;
