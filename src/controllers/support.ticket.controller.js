import SupportTicket, { SUPPORT_TICKET_STATUSES } from "../models/SupportTicket.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const LEGACY_STATUS_MAP = {
  open: "created",
  pending_user: "in_progress"
};
const STATUS_FILTER_MAP = {
  created: ["created", "open"],
  in_progress: ["in_progress", "pending_user"]
};

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const mapTicket = (doc, req) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.status = normalizeStatus(obj.status) || obj.status;
  if (Array.isArray(obj.statusHistory)) {
    obj.statusHistory = obj.statusHistory.map(item => ({
      ...item,
      status: normalizeStatus(item.status) || item.status
    }));
  }
  if (obj.attachment?.url) {
    obj.attachment.url = toAbsolute(obj.attachment.url, req);
  }
  if (obj.user && typeof obj.user === "object" && obj.user.mobileNumber) {
    obj.mobileNumber = obj.user.mobileNumber;
  }
  // Admin panel no longer uses assignment; hide to avoid client-side errors.
  delete obj.assignedTo;
  return obj;
};

const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  return LEGACY_STATUS_MAP[value] || value;
};

const migrateLegacyTicketStatus = async (ticket) => {
  const normalizedStatus = normalizeStatus(ticket.status);
  let changed = false;

  if (ticket.status !== normalizedStatus && SUPPORT_TICKET_STATUSES.includes(normalizedStatus)) {
    ticket.status = normalizedStatus;
    changed = true;
  }

  if (Array.isArray(ticket.statusHistory)) {
    ticket.statusHistory.forEach(item => {
      const normalizedHistoryStatus = normalizeStatus(item.status);
      if (item.status !== normalizedHistoryStatus && SUPPORT_TICKET_STATUSES.includes(normalizedHistoryStatus)) {
        item.status = normalizedHistoryStatus;
        changed = true;
      }
    });
  }

  if (changed) {
    await ticket.save();
  }

  return ticket;
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
      status: "created",
      statusHistory: [
        {
          status: "created",
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

    if (status) {
      const normalizedStatus = normalizeStatus(status);
      filter.status = STATUS_FILTER_MAP[normalizedStatus]
        ? { $in: STATUS_FILTER_MAP[normalizedStatus] }
        : normalizedStatus;
    }
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
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return errorResponse(res, 404, "Support ticket not found");
    }

    await migrateLegacyTicketStatus(ticket);
    await ticket.populate("user", "fullName email mobileNumber");
    await ticket.populate("statusHistory.changedBy", "fullName email role");

    return successResponse(res, 200, "Support ticket fetched", mapTicket(ticket, req));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const updateSupportTicketAdmin = async (req, res) => {
  try {
    const { status, adminNote, statusNote, note } = req.body || {};
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return errorResponse(res, 404, "Support ticket not found");
    }

    await migrateLegacyTicketStatus(ticket);

    let historyChanged = false;

    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      if (!SUPPORT_TICKET_STATUSES.includes(normalizedStatus)) {
        return errorResponse(res, 400, "status must be one of created, in_progress, resolved, closed");
      }
      if (ticket.status !== normalizedStatus) {
        ticket.status = normalizedStatus;
        historyChanged = true;
      }
    }

    if (adminNote !== undefined) {
      ticket.adminNote = String(adminNote || "").trim();
    }

    const historyNote = statusNote !== undefined ? statusNote : note;
    if (historyChanged || historyNote) {
      ticket.statusHistory.push({
        status: ticket.status,
        note: String(historyNote || "").trim() || `Status updated to ${ticket.status}`,
        changedBy: req.user._id
      });
    }

    await ticket.save();

    logger.info("Support ticket updated by admin", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      adminId: req.user._id,
      status: ticket.status,
      historyChanged
    });

    const populated = await SupportTicket.findById(ticket._id)
      .populate("user", "fullName email mobileNumber")
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

export const bulkDeleteSupportTicketsAdmin = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const normalized = ids.map(String).filter(Boolean);
    if (!normalized.length) return errorResponse(res, 400, "ids array required");

    const result = await SupportTicket.deleteMany({ _id: { $in: normalized } });
    return res.status(200).json({
      success: true,
      deleted: result.deletedCount || 0
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
