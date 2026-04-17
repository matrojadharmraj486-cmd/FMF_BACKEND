import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { getAdminStats, getAdminStatsTimeseries } from "../controllers/admin.stats.controller.js";

const router = express.Router();

router.get("/stats", adminAuthenticate, getAdminStats);
router.get("/stats/timeseries", adminAuthenticate, getAdminStatsTimeseries);

export default router;

