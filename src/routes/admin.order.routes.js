import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { getOrderAdminById, listOrdersAdmin } from "../controllers/admin.order.controller.js";

const router = express.Router();

router.get("/orders", adminAuthenticate, listOrdersAdmin);
router.get("/orders/:id", adminAuthenticate, getOrderAdminById);

export default router;

