import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  listSupportTicketsAdmin,
  getSupportTicketAdminById,
  updateSupportTicketAdmin
} from "../controllers/support.ticket.controller.js";

const router = express.Router();

router.get("/support-tickets", adminAuthenticate, listSupportTicketsAdmin);
router.get("/support-tickets/:id", adminAuthenticate, getSupportTicketAdminById);
router.patch("/support-tickets/:id", adminAuthenticate, updateSupportTicketAdmin);

export default router;
