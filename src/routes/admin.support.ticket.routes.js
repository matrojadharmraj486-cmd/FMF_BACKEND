import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  bulkDeleteSupportTicketsAdmin,
  listSupportTicketsAdmin,
  getSupportTicketAdminById,
  updateSupportTicketAdmin
} from "../controllers/support.ticket.controller.js";

const router = express.Router();

router.get("/support-tickets", adminAuthenticate, listSupportTicketsAdmin);
router.post("/support-tickets/bulk-delete", adminAuthenticate, bulkDeleteSupportTicketsAdmin);
router.get("/support-tickets/:id", adminAuthenticate, getSupportTicketAdminById);
router.patch("/support-tickets/:id", adminAuthenticate, updateSupportTicketAdmin);

export default router;
