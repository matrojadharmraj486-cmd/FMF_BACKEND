import mongoose from "mongoose";

export const SUPPORT_TICKET_STATUSES = ["created", "in_progress", "resolved", "closed"];

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String },
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number }
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: SUPPORT_TICKET_STATUSES,
      required: true
    },
    note: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    subject: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    description: { type: String, required: true, trim: true },
    attachment: attachmentSchema,
    status: {
      type: String,
      enum: SUPPORT_TICKET_STATUSES,
      default: "created",
      index: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminNote: { type: String, trim: true },
    statusHistory: [statusHistorySchema]
  },
  { timestamps: true }
);

supportTicketSchema.pre("validate", function () {
  if (!this.ticketNumber) {
    const stamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.ticketNumber = `TKT-${stamp}-${random}`;
  }
});

export default mongoose.model("SupportTicket", supportTicketSchema);
