import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import {
  createStructuredQuestion,
  uploadStructuredExcel,
  adminListStructuredQuestions,
  updateStructuredQuestion,
  clearStructuredQotdFlags,
  setActiveStructuredQotd,
  deleteStructuredQuestion,
  deleteStructuredQuestionsByYearPart,
  bulkDeleteStructuredQuestions,
  updateStructuredSub,
  deleteStructuredSub,
  uploadStructuredSubImage,
  listAdminYears,
  listAdminParts,
  listAdminPapers
} from "../controllers/structured.question.controller.js";

const router = express.Router();

router.post("/questions-structured", adminAuthenticate, createStructuredQuestion);
router.post("/questions-structured/upload", adminAuthenticate, upload.single("file"), uploadStructuredExcel);
router.get("/questions-structured", adminListStructuredQuestions);
router.get("/questions-structured/years", adminAuthenticate, listAdminYears);
router.get("/questions-structured/parts", adminAuthenticate, listAdminParts);
router.get("/questions-structured/papers", adminAuthenticate, listAdminPapers);
router.put("/questions-structured/:id", adminAuthenticate, updateStructuredQuestion);
router.post("/questions-structured/qotd/clear", adminAuthenticate, clearStructuredQotdFlags);
router.post("/questions-structured/qotd/active/:id", adminAuthenticate, setActiveStructuredQotd);
router.delete("/questions-structured", adminAuthenticate, deleteStructuredQuestionsByYearPart);
router.post("/questions-structured/bulk-delete", adminAuthenticate, bulkDeleteStructuredQuestions);
router.delete("/questions-structured/:id", adminAuthenticate, deleteStructuredQuestion);
router.put("/questions-structured/:id/sub/:subId", adminAuthenticate, updateStructuredSub);
router.delete("/questions-structured/:id/sub/:subId", adminAuthenticate, deleteStructuredSub);
router.post("/questions-structured/:id/sub/:subId/image", adminAuthenticate, upload.single("image"), uploadStructuredSubImage);

export default router;
