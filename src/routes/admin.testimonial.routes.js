import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { authenticate } from "../middleware/auth.js";
import {
  createTestimonial,
  deleteTestimonial,
  getTestimonialsAdmin,
  updateTestimonial
} from "../controllers/testimonial.controller.js";

const router = express.Router();

router.post("/testimonials", adminAuthenticate, upload.single("photo"), createTestimonial);
router.get("/testimonials", adminAuthenticate, getTestimonialsAdmin);
router.get("/app-testimonials", authenticate, getTestimonialsAdmin);
router.put("/testimonials/:id", adminAuthenticate, upload.single("photo"), updateTestimonial);
router.delete("/testimonials/:id", adminAuthenticate, deleteTestimonial);

export default router;