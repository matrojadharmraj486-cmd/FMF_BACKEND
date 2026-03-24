import express from "express";
import { authenticate } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createSupportTicket,
  listMySupportTickets,
  getMySupportTicketById
} from "../controllers/support.ticket.controller.js";

const router = express.Router();

router.post("/support-tickets", authenticate, upload.single("attachment"), createSupportTicket);
router.get("/support-tickets", authenticate, listMySupportTickets);
router.get("/support-tickets/:id", authenticate, getMySupportTicketById);

export default router;
