import express from "express";
import { getBanners } from "../controllers/banner.controller.js";

const router = express.Router();

router.get("/banners", getBanners);

export default router;

