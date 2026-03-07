import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import {
  createStructuredQuestion,
  uploadStructuredExcel,
  adminListStructuredQuestions,
  updateStructuredQuestion,
  deleteStructuredQuestion,
  updateStructuredSub,
  deleteStructuredSub,
  uploadStructuredSubImage
} from "../controllers/structured.question.controller.js";

const router = express.Router();

router.post("/questions-structured", adminAuthenticate, createStructuredQuestion);
router.post("/questions-structured/upload", adminAuthenticate, upload.single("file"), uploadStructuredExcel);
router.get("/questions-structured", adminAuthenticate, adminListStructuredQuestions);
router.put("/questions-structured/:id", adminAuthenticate, updateStructuredQuestion);
router.delete("/questions-structured/:id", adminAuthenticate, deleteStructuredQuestion);
router.put("/questions-structured/:id/sub/:subId", adminAuthenticate, updateStructuredSub);
router.delete("/questions-structured/:id/sub/:subId", adminAuthenticate, deleteStructuredSub);
router.post("/questions-structured/:id/sub/:subId/image", adminAuthenticate, upload.single("image"), uploadStructuredSubImage);

export default router;
