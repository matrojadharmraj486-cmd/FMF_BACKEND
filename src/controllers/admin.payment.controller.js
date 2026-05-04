import Payment from "../models/Payment.js";
import { successResponse, errorResponse } from "../utils/response.js";

const formatPayment = (doc) => {
  const obj = doc?.toObject ? doc.toObject() : { ...doc };
  return {
    ...obj,
    amount: Number(obj.amount) || obj.amount,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

export const listPaymentsAdmin = async (req, res) => {
  try {
    const { userId } = req.query || {};
    const filter = {};
    if (userId) filter.user = userId;

    const payments = await Payment.find(filter)
      .populate("subscription")
      .populate("user", "fullName email mobileNumber")
      .sort({ createdAt: -1 });

    return successResponse(res, 200, "Payments fetched", payments.map(formatPayment));
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

