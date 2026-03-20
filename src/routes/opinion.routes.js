import express from "express";
import {
  createOpinion,
  getOpinions
} from "../controllers/opinion.controller.js";

const router = express.Router();

router.post("/opinions", createOpinion);
router.get("/opinions", getOpinions);

export default router;
