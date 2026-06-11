import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  bulkDeleteOrdersAdmin,
  deleteOrderAdmin,
  downloadOrderInvoiceAdmin,
  getOrderAdminById,
  listOrdersAdmin
} from "../controllers/admin.order.controller.js";

const router = express.Router();

router.get("/orders", adminAuthenticate, listOrdersAdmin);
router.post("/orders/bulk-delete", adminAuthenticate, bulkDeleteOrdersAdmin);
router.get("/orders/:id/invoice", adminAuthenticate, downloadOrderInvoiceAdmin);
router.get("/orders/:id", adminAuthenticate, getOrderAdminById);
router.delete("/orders/:id", adminAuthenticate, deleteOrderAdmin);

export default router;
