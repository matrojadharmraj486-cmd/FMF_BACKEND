import SupportTicket from "../models/SupportTicket.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

const VALID_STATUSES = ["open", "in_progress", "pending_user", "resolved", "closed"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const mapTicket = (doc, req) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj.attachment?.url) {
    obj.attachment.url = toAbsolute(obj.attachment.url, req);
  }
  if (obj.user && typeof obj.user === "object" && obj.user.mobileNumber) {
    obj.mobileNumber = obj.user.mobileNumber;
  }
  return obj;
};

export const createSupportTicket = async (req, res) => {
  try {
    const subject = String(req.body.subject || "").trim();
    const category = String(req.body.category || "").trim();
    const priority = String(req.body.priority || "medium").trim().toLowerCase();
    const description = String(req.body.description || "").trim();

    if (!subject || !category || !description) {
      return errorResponse(res, 400, "subject, category and description are required");
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return errorResponse(res, 400, "priority must be one of low, medium, high, urgent");
    }

    const payload = {
      user: req.user._id,
      subject,
      category,
      priority,
      description,
      status: "open",
      statusHistory: [
        {
          status: "open",
          note: "Ticket created",
          changedBy: req.user._id
        }
      ]
    };

    if (req.file) {
      payload.attachment = {
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
    }

    logger.info("Support ticket creation requested", {
      userId: req.user._id,
      category,
      priority,
      hasAttachment: Boolean(req.file)
    });

    const ticket = await SupportTicket.create(payload);
    const populated = await SupportTicket.findById(ticket._id).populate(
      "user",
      "fullName email mobileNumber"
    );

    logger.info("Support ticket created", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      userId: req.user._id,
      status: ticket.status
    });

    return successResponse(res, 201, "Support ticket created", mapTicket(populated, req));
  } catch (e) {
    logger.error("Support ticket creation failed", {
      userId: req.user?._id,
      error: e.message,
      stack: e.stack
    });
    return errorResponse(res, 500, e.message);
  }
};

export const listMySupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    return successResponse(
      res,
      200,
      "Support tickets fetched",
      tickets.map(ticket => mapTicket(ticket, req))
    );
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getMySupportTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!ticket) {
      return errorResponse(res, 404, "Support ticket not found");
    }

    return successResponse(res, 200, "Support ticket fetched", mapTicket(ticket, req));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const listSupportTicketsAdmin = async (req, res) => {
  try {
    const { status, category, priority, search } = req.query;
    const filter = {};

    if (status) filter.status = String(status).trim().toLowerCase();
    if (category) filter.category = String(category).trim();
    if (priority) filter.priority = String(priority).trim().toLowerCase();
    if (search) {
      const safe = String(search).trim();
      filter.$or = [
        { ticketNumber: { $regex: safe, $options: "i" } },
        { subject: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } }
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .populate("user", "fullName email mobileNumber")
      .populate("assignedTo", "fullName email")
      .sort({ createdAt: -1 });

    return successResponse(
      res,
      200,
      "Support tickets fetched",
      tickets.map(ticket => mapTicket(ticket, req))
    );
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getSupportTicketAdminById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("user", "fullName email mobileNumber")
      .populate("assignedTo", "fullName email")
      .populate("statusHistory.changedBy", "fullName email role");

    if (!ticket) {
      return errorResponse(res, 404, "Support ticket not found");
    }

    return successResponse(res, 200, "Support ticket fetched", mapTicket(ticket, req));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSupportTicketAdmin = async (req, res) => {
  try {
    const { status, assignedTo, adminNote, note } = req.body || {};
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return errorResponse(res, 404, "Support ticket not found");
    }

    let historyChanged = false;

    if (status !== undefined) {
      const normalizedStatus = String(status).trim().toLowerCase();
      if (!VALID_STATUSES.includes(normalizedStatus)) {
        return errorResponse(res, 400, "status must be one of open, in_progress, pending_user, resolved, closed");
      }
      if (ticket.status !== normalizedStatus) {
        ticket.status = normalizedStatus;
        historyChanged = true;
      }
    }

    if (assignedTo !== undefined) {
      ticket.assignedTo = assignedTo || undefined;
    }

    if (adminNote !== undefined) {
      ticket.adminNote = String(adminNote || "").trim();
    }

    if (historyChanged || note) {
      ticket.statusHistory.push({
        status: ticket.status,
        note: String(note || "").trim() || `Status updated to ${ticket.status}`,
        changedBy: req.user._id
      });
    }

    await ticket.save();

    logger.info("Support ticket updated by admin", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      adminId: req.user._id,
      status: ticket.status,
      assignedTo: ticket.assignedTo || null,
      historyChanged
    });

    const populated = await SupportTicket.findById(ticket._id)
      .populate("user", "fullName email mobileNumber")
      .populate("assignedTo", "fullName email")
      .populate("statusHistory.changedBy", "fullName email role");

    return successResponse(res, 200, "Support ticket updated", mapTicket(populated, req));
  } catch (e) {
    logger.error("Support ticket admin update failed", {
      ticketId: req.params.id,
      adminId: req.user?._id,
      error: e.message,
      stack: e.stack
    });
    return errorResponse(res, 500, e.message);
  }
};
