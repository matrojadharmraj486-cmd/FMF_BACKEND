import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import {
  createTestimonial,
  deleteTestimonial,
  getTestimonialsAdmin
} from "../controllers/testimonial.controller.js";

const router = express.Router();

router.post("/testimonials", adminAuthenticate, upload.single("photo"), createTestimonial);
router.get("/testimonials", adminAuthenticate, getTestimonialsAdmin);
router.delete("/testimonials/:id", adminAuthenticate, deleteTestimonial);

export default router;
