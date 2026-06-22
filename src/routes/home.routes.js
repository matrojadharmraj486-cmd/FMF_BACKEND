import express from "express";
import { getHomeData } from "../controllers/home.controller.js";
import { optionalAuthenticate } from "../middleware/auth.js";

const router = express.Router();

// Public route. When a valid Bearer token is sent, the response is enriched
// with the authenticated user's `subscription` summary.
router.get("/home", optionalAuthenticate, getHomeData);

export default router;
