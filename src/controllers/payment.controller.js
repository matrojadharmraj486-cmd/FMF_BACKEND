import crypto from "crypto";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { razorpay, keyId, keySecret } from "../utils/razorpay.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toPaise = (amountInr) => Math.round(amountInr * 100);

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
};

export const createOrder = async (req, res) => {
  try {
    if (!razorpay || !keyId || !keySecret) {
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

    const amount = toPaise(subscription.price);
    if (!amount || amount <= 0) return errorResponse(res, 400, "Invalid subscription amount");

    const receipt = `sub_${subscription._id}_${Date.now()}`;
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
      subscription,
      paymentId: payment._id
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const verifyPayment = async (req, res) => {
  try {
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

      await activateSubscriptionForUser({
        userId: payment.user,
        subscription: payment.subscription,
        paymentId: payment._id
      });
    }

    return successResponse(res, 200, "Payment verified", {
      paymentId: payment._id,
      status: payment.status
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
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
    return errorResponse(res, 500, e.message);
  }
};
