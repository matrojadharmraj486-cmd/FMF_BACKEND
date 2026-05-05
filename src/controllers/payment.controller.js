import crypto from "crypto";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { getRazorpayClient } from "../utils/razorpay.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { sendBrevoEmail } from "../utils/email.js";
import { buildSubscriptionActivatedEmail } from "../utils/emailTemplates.js";

const toPaise = (amountInr) => Math.round(amountInr * 100);
const formatPrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : value;
};

const calcSubscriptionTotals = (subscription) => {
  const base = Number(subscription?.price);
  const gstPercent = Number(subscription?.gstPercent);
  const gst = Number.isFinite(gstPercent) ? gstPercent : 0;
  if (!Number.isFinite(base)) return null;
  const gstAmount = Math.round((base * gst / 100) * 100) / 100;
  const total = Math.round((base + gstAmount) * 100) / 100;
  return { base, gstPercent: gst, gstAmount, total };
};

const serializeError = (e) => {
  if (!e) return {};
  return {
    name: e.name,
    message: e.message,
    stack: e.stack,
    code: e.code,
    statusCode: e.statusCode,
    error: e.error,
    description: e.error?.description || e.description
  };
};

const activateSubscriptionForUser = async ({ userId, subscription, paymentId }) => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + Number(subscription.durationDays || 0));

  await User.findByIdAndUpdate(userId, {
    isSubscribed: true,
    subscription: {
      plan: subscription._id,
      status: "active",
      startDate: now,
      endDate,
      lastPaymentId: paymentId
    }
  });

  return { startDate: now, endDate };
};

export const createOrder = async (req, res) => {
  try {
    const { razorpay, keyId, keySecret, isActive, source } = await getRazorpayClient();
    if (!razorpay || !keyId || !keySecret) {
      if (source === "db" && isActive === false) {
        return errorResponse(res, 503, "Razorpay is inactive");
      }
      return errorResponse(res, 503, "Razorpay is not configured");
    }
    const { subscriptionId } = req.body || {};
    if (!subscriptionId) return errorResponse(res, 400, "subscriptionId is required");

    if (req.user?.subscription?.status === "active" && req.user?.subscription?.endDate) {
      const endDate = new Date(req.user.subscription.endDate);
      if (endDate > new Date()) {
        return errorResponse(res, 400, "User already has an active subscription");
      }
    }

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || !subscription.isActive)
      return errorResponse(res, 404, "Subscription not available");

    const totals = calcSubscriptionTotals(subscription);
    const totalInr = totals?.total ?? Number(subscription.price);
    const amount = toPaise(totalInr);
    if (!amount || amount <= 0) return errorResponse(res, 400, "Invalid subscription amount");

    const shortSubId = String(subscription._id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-10);
    const receipt = `sub_${shortSubId}_${Date.now()}`.slice(0, 40);
    const order = await razorpay.orders.create({
      amount,
      currency: subscription.currency || "INR",
      receipt,
      payment_capture: 1,
      notes: {
        userId: req.user?._id?.toString(),
        subscriptionId: subscription._id.toString()
      }
    });

    const payment = await Payment.create({
      user: req.user?._id,
      subscription: subscription._id,
      amount,
      currency: order.currency || subscription.currency || "INR",
      razorpayOrderId: order.id,
      receipt,
      notes: order.notes
    });

    return successResponse(res, 201, "Order created", {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      subscription: {
        ...(subscription.toObject ? subscription.toObject() : subscription),
        price: formatPrice(subscription.price),
        gstPercent: totals
          ? totals.gstPercent
          : Number.isFinite(Number(subscription.gstPercent))
            ? Number(subscription.gstPercent)
            : 0,
        gstAmount: formatPrice(totals?.gstAmount ?? 0),
        totalPrice: formatPrice(totals?.total ?? subscription.price)
      },
      paymentId: payment._id
    });
  } catch (e) {
    logger.error("Create order failed", {
      error: serializeError(e),
      userId: req.user?._id,
      subscriptionId: req.body?.subscriptionId
    });
    const rawMsg = e?.error?.description || e?.message || "Create order failed";
    const statusCode = Number(e?.statusCode);
    const isGatewayAuthFailure =
      statusCode === 401 ||
      String(rawMsg || "").toLowerCase().includes("authentication failed");
    if (isGatewayAuthFailure) {
      return errorResponse(
        res,
        503,
        "Payment gateway authentication failed. Please verify Razorpay keyId/keySecret in admin settings or server env."
      );
    }
    return errorResponse(res, 500, rawMsg);
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { keySecret } = await getRazorpayClient({ allowInactive: true });
    if (!keySecret) {
      return errorResponse(res, 503, "Razorpay is not configured");
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return errorResponse(res, 400, "razorpay_order_id, razorpay_payment_id, razorpay_signature required");
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: "failed", error: { reason: "signature_mismatch" } }
      );
      return errorResponse(res, 400, "Invalid payment signature");
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id }).populate(
      "subscription"
    );
    if (!payment) return errorResponse(res, 404, "Payment not found");
    if (payment.user?.toString() !== req.user?._id?.toString()) {
      return errorResponse(res, 403, "Payment does not belong to this user");
    }

    if (payment.status !== "paid") {
      payment.status = "paid";
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      await payment.save();

      const { startDate, endDate } = await activateSubscriptionForUser({
        userId: payment.user,
        subscription: payment.subscription,
        paymentId: payment._id
      });

      try {
        const user = await User.findById(payment.user).lean();
        const email = String(user?.email || "").trim();
        if (email) {
          const tpl = buildSubscriptionActivatedEmail({
            userName: user?.fullName || "User",
            planName: payment.subscription?.name,
            startDate,
            expiryDate: endDate
          });
          await sendBrevoEmail({
            to: email,
            subject: tpl.subject,
            text: tpl.text,
            html: tpl.html
          });
        }
      } catch (e) {
        logger.warn("Subscription activation email failed", {
          userId: payment.user,
          paymentId: payment._id,
          error: e.message
        });
      }
    }

    return successResponse(res, 200, "Payment verified", {
      paymentId: payment._id,
      status: payment.status
    });
  } catch (e) {
    logger.error("Verify payment failed", {
      error: serializeError(e),
      userId: req.user?._id,
      orderId: req.body?.razorpay_order_id
    });
    const msg = e?.error?.description || e?.message || "Verify payment failed";
    return errorResponse(res, 500, msg);
  }
};

export const markPaymentFailed = async (req, res) => {
  try {
    const { razorpay_order_id, reason, error } = req.body || {};
    if (!razorpay_order_id) {
      return errorResponse(res, 400, "razorpay_order_id required");
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) return errorResponse(res, 404, "Payment not found");
    if (payment.user?.toString() !== req.user?._id?.toString()) {
      return errorResponse(res, 403, "Payment does not belong to this user");
    }

    payment.status = "failed";
    payment.error = error || (reason ? { reason } : payment.error);
    await payment.save();

    return successResponse(res, 200, "Payment marked failed", {
      paymentId: payment._id,
      status: payment.status
    });
  } catch (e) {
    logger.error("Mark payment failed", {
      error: serializeError(e),
      userId: req.user?._id,
      orderId: req.body?.razorpay_order_id
    });
    const msg = e?.error?.description || e?.message || "Mark payment failed";
    return errorResponse(res, 500, msg);
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!webhookSecret) {
      return errorResponse(res, 503, "Razorpay webhook is not configured");
    }
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody || Buffer.from("");

    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (!signature || expected !== signature) {
      return errorResponse(res, 400, "Invalid webhook signature");
    }

    const event = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;

    if (!orderId) return successResponse(res, 200, "No order found in webhook");

    const payment = await Payment.findOne({ razorpayOrderId: orderId }).populate("subscription");
    if (!payment) return successResponse(res, 200, "Payment not tracked");

    if (event === "payment.captured") {
      if (payment.status !== "paid") {
        payment.status = "paid";
        payment.razorpayPaymentId = paymentEntity?.id;
        payment.method = paymentEntity?.method;
        await payment.save();

        await activateSubscriptionForUser({
          userId: payment.user,
          subscription: payment.subscription,
          paymentId: payment._id
        });
      }
    } else if (event === "payment.failed") {
      payment.status = "failed";
      payment.error = paymentEntity?.error_reason
        ? { reason: paymentEntity.error_reason }
        : payment.error;
      await payment.save();
    }

    return successResponse(res, 200, "Webhook processed");
  } catch (e) {
    logger.error("Webhook handling failed", {
      error: serializeError(e)
    });
    const msg = e?.error?.description || e?.message || "Webhook failed";
    return errorResponse(res, 500, msg);
  }
};

export const listMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user?._id })
      .populate("subscription")
      .sort({ createdAt: -1 });

    const data = payments.map((p) => {
      const obj = p?.toObject ? p.toObject() : { ...p };
      const amountPaise = Number(obj.amount);
      return {
        ...obj,
        amountPaise: Number.isFinite(amountPaise) ? amountPaise : obj.amount,
        amountInr: Number.isFinite(amountPaise) ? amountPaise / 100 : undefined
      };
    });

    return successResponse(res, 200, "Payments fetched", data);
  } catch (e) {
    logger.error("List payments failed", {
      error: serializeError(e),
      userId: req.user?._id
    });
    return errorResponse(res, 500, e.message);
  }
};
