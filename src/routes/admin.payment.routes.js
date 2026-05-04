import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { listPaymentsAdmin } from "../controllers/admin.payment.controller.js";

const router = express.Router();

router.get("/payments", adminAuthenticate, listPaymentsAdmin);

export default router;

