import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { createBanner, deleteBanner, getAllBannersAdmin, updateBanner } from "../controllers/banner.controller.js";

const router = express.Router();

router.post("/banners", adminAuthenticate, upload.single("image"), createBanner);
router.put("/banners/:id", adminAuthenticate, upload.single("image"), updateBanner);
router.delete("/banners/:id", adminAuthenticate, deleteBanner);
router.get("/banner", adminAuthenticate, getAllBannersAdmin);

export default router;