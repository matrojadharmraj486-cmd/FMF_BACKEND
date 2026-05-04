import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  bulkDeleteOpinions,
  deleteOpinion,
  listOpinionsAdmin
} from "../controllers/opinion.controller.js";

const router = express.Router();

router.get("/opinions", adminAuthenticate, listOpinionsAdmin);
router.delete("/opinions/:id", adminAuthenticate, deleteOpinion);
router.post("/opinions/bulk-delete", adminAuthenticate, bulkDeleteOpinions);

export default router;

