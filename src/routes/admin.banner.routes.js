import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { createBanner, deleteBanner } from "../controllers/banner.controller.js";

const router = express.Router();

router.post("/banners", adminAuthenticate, upload.single("image"), createBanner);
router.delete("/banners/:id", adminAuthenticate, deleteBanner);

export default router;
