import Payment, { getNextOrderNumber } from "../models/Payment.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toAbsolute = (path, req) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  return `${proto}://${req.get("host")}${path}`;
};

const normalizePaymentStatus = (status) => {
  return status === "paid" ? "completed" : "pending";
};

const normalizeOrderStatus = (status) => {
  return normalizePaymentStatus(status);
};

const toStoredPaymentStatusFilter = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed") return "paid";
  if (normalized === "pending") return { $in: ["created", "failed", "refunded"] };
  return normalized;
};

const ensureOrderNumber = async (doc) => {
  if (!doc || doc.orderNumber) return doc;

  const orderNumber = await getNextOrderNumber();
  const updated = await Payment.findOneAndUpdate(
    { _id: doc._id, $or: [{ orderNumber: { $exists: false } }, { orderNumber: null }, { orderNumber: "" }] },
    { $set: { orderNumber } },
    { new: true }
  )
    .populate("subscription")
    .populate("user", "fullName email mobileNumber");

  if (updated) return updated;

  return Payment.findById(doc._id)
    .populate("subscription")
    .populate("user", "fullName email mobileNumber");
};

const formatOrder = (doc, req) => {
  const obj = doc?.toObject ? doc.toObject() : { ...doc };
  const amountPaise = Number(obj.amount);
  const totalAmount = Number.isFinite(amountPaise) ? amountPaise / 100 : obj.amount;
  const orderDate = obj.createdAt;
  const paymentStatus = normalizePaymentStatus(obj.status);
  const orderStatus = normalizeOrderStatus(obj.status);
  const invoicePath = `/api/admin/orders/${obj._id}/invoice`;
  const invoiceUrl = toAbsolute(invoicePath, req);
  const token = req.headers.authorization?.split(" ")[1] || req.query.token;
  const downloadInvoiceUrl = token ? `${invoiceUrl}?token=${token}` : invoiceUrl;
  const user = obj.user && typeof obj.user === "object"
    ? { ...obj.user, name: obj.user.name || obj.user.fullName || "" }
    : obj.user;

  return {
    ...obj,
    user,
    orderId: obj._id,
    gatewayOrderId: obj.razorpayOrderId,
    orderNumber: obj.orderNumber,
    orderDate,
    paymentStatus,
    orderStatus,
    invoiceUrl,
    downloadInvoiceUrl,
    totalAmount,
    amountPaise: Number.isFinite(amountPaise) ? amountPaise : obj.amount,
    amountInr: Number.isFinite(amountPaise) ? amountPaise / 100 : undefined
  };
};

export const listOrdersAdmin = async (req, res) => {
  try {
    const { status, userId, subscriptionId, search, dateFrom, dateTo } = req.query || {};
    const filter = {};
    if (status) filter.status = toStoredPaymentStatusFilter(status);
    if (userId) filter.user = userId;
    if (subscriptionId) filter.subscription = subscriptionId;

    const createdAt = {};
    if (dateFrom) {
      const dt = new Date(String(dateFrom));
      if (!Number.isNaN(dt.getTime())) createdAt.$gte = dt;
    }
    if (dateTo) {
      const dt = new Date(String(dateTo));
      if (!Number.isNaN(dt.getTime())) createdAt.$lte = dt;
    }
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;

    if (search) {
      const q = String(search).trim();
      if (q) {
        filter.$or = [
          { orderNumber: { $regex: q, $options: "i" } },
          { razorpayOrderId: { $regex: q, $options: "i" } },
          { razorpayPaymentId: { $regex: q, $options: "i" } },
          { receipt: { $regex: q, $options: "i" } }
        ];
      }
    }

    const page = Math.max(1, toNumber(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, toNumber(req.query?.limit) || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate("subscription")
        .populate("user", "fullName email mobileNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter)
    ]);

    const numberedItems = await Promise.all(items.map(ensureOrderNumber));
    const orders = numberedItems.map(item => formatOrder(item, req));

    return successResponse(res, 200, "Orders fetched", {
      items: orders,
      data: orders,
      page,
      limit,
      total
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const getOrderAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Payment.findById(id)
      .populate("subscription")
      .populate("user", "fullName email mobileNumber");
    if (!doc) return errorResponse(res, 404, "Order not found");
    const numberedDoc = await ensureOrderNumber(doc);
    return successResponse(res, 200, "Order fetched", formatOrder(numberedDoc, req));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const downloadOrderInvoiceAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Payment.findById(id)
      .populate("subscription")
      .populate("user", "fullName email mobileNumber");
    if (!doc) return errorResponse(res, 404, "Order not found");

    const numberedDoc = await ensureOrderNumber(doc);
    const order = formatOrder(numberedDoc, req);
    const invoice = [
      "Invoice",
      `Order Number: ${order.orderNumber}`,
      `Order Date: ${new Date(order.orderDate).toISOString()}`,
      `Customer: ${order.user?.fullName || order.user?.name || ""}`,
      `Email: ${order.user?.email || ""}`,
      `Mobile: ${order.user?.mobileNumber || ""}`,
      `Subscription: ${order.subscription?.name || ""}`,
      `Total Amount: ${order.totalAmount} ${order.currency || "INR"}`,
      `Payment Status: ${order.paymentStatus}`,
      `Order Status: ${order.orderStatus}`
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.orderNumber}.txt"`);
    return res.status(200).send(invoice);
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
