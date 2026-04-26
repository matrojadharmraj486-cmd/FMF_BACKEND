import express from "express";
import { listFaqsPublic } from "../controllers/faq.controller.js";

const router = express.Router();

router.get("/faqs", listFaqsPublic);

export default router;

