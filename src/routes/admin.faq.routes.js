import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { createFaq, deleteFaq, listFaqsAdmin, updateFaq } from "../controllers/faq.controller.js";

const router = express.Router();

router.get("/faqs", adminAuthenticate, listFaqsAdmin);
router.post("/faqs", adminAuthenticate, createFaq);
router.put("/faqs/:id", adminAuthenticate, updateFaq);
router.delete("/faqs/:id", adminAuthenticate, deleteFaq);

export default router;

