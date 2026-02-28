import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { createQuestion, updateQuestion, deleteQuestion, uploadQuestionsExcel } from "../controllers/admin.question.controller.js";

const router = express.Router();

router.post("/questions", adminAuthenticate, upload.single("answerImage"), createQuestion);
router.put("/questions/:id", adminAuthenticate, upload.single("answerImage"), updateQuestion);
router.delete("/questions/:id", adminAuthenticate, deleteQuestion);
router.post("/questions/upload", adminAuthenticate, upload.single("file"), uploadQuestionsExcel);

export default router;
