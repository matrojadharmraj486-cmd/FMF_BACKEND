import Payment from "../models/Payment.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatOrder = (doc) => {
  const obj = doc?.toObject ? doc.toObject() : { ...doc };
  const amountPaise = Number(obj.amount);
  return {
    ...obj,
    orderId: obj.razorpayOrderId,
    amountPaise: Number.isFinite(amountPaise) ? amountPaise : obj.amount,
    amountInr: Number.isFinite(amountPaise) ? amountPaise / 100 : undefined
  };
};

export const listOrdersAdmin = async (req, res) => {
  try {
    const { status, userId, subscriptionId, search, dateFrom, dateTo } = req.query || {};
    const filter = {};
    if (status) filter.status = String(status).trim().toLowerCase();
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

    return successResponse(res, 200, "Orders fetched", {
      items: items.map(formatOrder),
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
    return successResponse(res, 200, "Order fetched", formatOrder(doc));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

