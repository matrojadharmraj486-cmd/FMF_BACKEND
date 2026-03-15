import express from "express";
import { getTestimonialsPublic } from "../controllers/testimonial.controller.js";

const router = express.Router();

router.get("/testimonials", getTestimonialsPublic);

export default router;
