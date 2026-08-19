import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import { getRazorpayClient } from "../utils/razorpay.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { sendEmailInBackground } from "../utils/email.js";
import { buildSubscriptionActivatedEmail } from "../utils/emailTemplates.js";
import { verifyAppleSignedData, decodeAppleSignedDataUnsafe } from "../utils/appleIap.js";
import { verifyGooglePurchase, isGooglePlayConfigured } from "../utils/googlePlay.js";

const toPaise = (amountInr) => Math.round(amountInr * 100);
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const formatPrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : value;
};

const calculateCouponDiscount = (originalAmount, coupon) => {
  if (!coupon) {
    return {
      couponCode: null,
      couponId: null,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      discountedAmount: originalAmount
    };
  }

  const discountValue = Number(coupon.discountValue || 0);
  const rawDiscount = coupon.discountType === "percentage"
    ? originalAmount * discountValue / 100
    : discountValue;
  const discountAmount = Math.min(originalAmount, Math.max(0, roundMoney(rawDiscount)));
  const discountedAmount = Math.max(0, roundMoney(originalAmount - discountAmount));

  return {
    couponCode: coupon.code,
    couponId: coupon._id,
    discountType: coupon.discountType,
    discountValue,
    discountAmount,
    discountedAmount
  };
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

// --- Payment debug logging (testing aid) -------------------------------------
// Plain console.log tracing so the full payment lifecycle is visible in the
// process/pm2 logs. Every line is prefixed `[PAYMENT][<stage>]` so it can be
// grepped easily. Secrets (key secret) are never logged; signatures/ids are
// masked. Remove or lower verbosity once the flow is confirmed working.
const payLog = (stage, data) => {
  try {
    console.log(`[PAYMENT][${stage}]`, JSON.stringify(data));
  } catch {
    console.log(`[PAYMENT][${stage}]`, data);
  }
};

const maskValue = (v) => {
  const s = String(v ?? "");
  if (!s) return "";
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};

const activateSubscriptionForUser = async ({ userId, subscription, paymentId }) => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + Number(subscription.durationDays || 0));

  payLog("activateSubscription:start", {
    userId: String(userId || ""),
    planId: String(subscription?._id || ""),
    planName: subscription?.name,
    durationDays: subscription?.durationDays,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    paymentId: String(paymentId || "")
  });

  const updated = await User.findByIdAndUpdate(
    userId,
    {
      isSubscribed: true,
      subscription: {
        plan: subscription._id,
        status: "active",
        startDate: now,
        endDate,
        lastPaymentId: paymentId
      }
    },
    { new: true }
  );

  payLog("activateSubscription:done", {
    userId: String(userId || ""),
    userFound: !!updated,
    isSubscribed: updated?.isSubscribed,
    subscriptionStatus: updated?.subscription?.status,
    endDate: updated?.subscription?.endDate
  });

  return { startDate: now, endDate };
};

export const createOrder = async (req, res) => {
  try {
    payLog("createOrder:request", {
      userId: String(req.user?._id || ""),
      bodyKeys: Object.keys(req.body || {}),
      subscriptionId: req.body?.subscriptionId,
      couponCode: req.body?.couponCode || req.body?.appliedCouponCode,
      couponId: req.body?.couponId
    });

    const { razorpay, keyId, keySecret, isActive, source } = await getRazorpayClient();
    payLog("createOrder:gateway", {
      source,
      isActive,
      hasClient: !!razorpay,
      hasKeyId: !!keyId,
      hasKeySecret: !!keySecret,
      keyId: maskValue(keyId)
    });
    if (!razorpay || !keyId || !keySecret) {
      if (source === "db" && isActive === false) {
        payLog("createOrder:reject", { reason: "gateway_inactive" });
        return errorResponse(res, 503, "Razorpay is inactive");
      }
      payLog("createOrder:reject", { reason: "gateway_not_configured" });
      return errorResponse(res, 503, "Razorpay is not configured");
    }
    const { subscriptionId } = req.body || {};
    const requestedCouponCode = String(req.body?.couponCode || req.body?.appliedCouponCode || "").trim().toUpperCase();
    const requestedCouponId = String(req.body?.couponId || "").trim();
    if (requestedCouponId && !mongoose.Types.ObjectId.isValid(requestedCouponId)) {
      return errorResponse(res, 400, "Invalid coupon id");
    }
    if (!subscriptionId) return errorResponse(res, 400, "subscriptionId is required");

    if (req.user?.subscription?.status === "active" && req.user?.subscription?.endDate) {
      const endDate = new Date(req.user.subscription.endDate);
      if (endDate > new Date()) {
        return errorResponse(res, 400, "User already has an active subscription");
      }
    }

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || !subscription.isActive) {
      payLog("createOrder:reject", {
        reason: "subscription_unavailable",
        subscriptionId,
        found: !!subscription,
        isActive: subscription?.isActive
      });
      return errorResponse(res, 404, "Subscription not available");
    }
    payLog("createOrder:subscription", {
      id: String(subscription._id),
      name: subscription.name,
      price: subscription.price,
      gstPercent: subscription.gstPercent,
      durationDays: subscription.durationDays,
      currency: subscription.currency
    });

    const totals = calcSubscriptionTotals(subscription);
    const originalAmount = roundMoney(totals?.total ?? Number(subscription.price));
    let coupon = null;
    if (requestedCouponCode || requestedCouponId) {
      const couponFilter = {
        isActive: true,
        ...(requestedCouponId ? { _id: requestedCouponId } : { code: requestedCouponCode })
      };
      coupon = await Coupon.findOne(couponFilter);
      if (!coupon) return errorResponse(res, 404, "Invalid or inactive coupon code");
    }

    const discount = calculateCouponDiscount(originalAmount, coupon);
    const amount = toPaise(discount.discountedAmount);
    payLog("createOrder:amount", {
      originalAmount,
      couponCode: discount.couponCode,
      discountType: discount.discountType,
      discountAmount: discount.discountAmount,
      discountedAmount: discount.discountedAmount,
      amountPaise: amount
    });
    if (!amount || amount <= 0) {
      payLog("createOrder:reject", { reason: "invalid_amount", amountPaise: amount });
      return errorResponse(res, 400, "Invalid subscription amount");
    }

    const shortSubId = String(subscription._id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-10);
    const receipt = `sub_${shortSubId}_${Date.now()}`.slice(0, 40);
    const order = await razorpay.orders.create({
      amount,
      currency: subscription.currency || "INR",
      receipt,
      payment_capture: 1,
      notes: {
        userId: req.user?._id?.toString(),
        subscriptionId: subscription._id.toString(),
        couponCode: discount.couponCode || undefined,
        originalAmount,
        discountAmount: discount.discountAmount,
        discountedAmount: discount.discountedAmount
      }
    });
    payLog("createOrder:razorpayOrder", {
      orderId: order?.id,
      status: order?.status,
      amount: order?.amount,
      currency: order?.currency,
      receipt: order?.receipt
    });

    const payment = await Payment.create({
      user: req.user?._id,
      subscription: subscription._id,
      amount,
      originalAmount,
      couponCode: discount.couponCode,
      couponId: discount.couponId,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountAmount: discount.discountAmount,
      discountedAmount: discount.discountedAmount,
      currency: order.currency || subscription.currency || "INR",
      razorpayOrderId: order.id,
      receipt,
      notes: order.notes
    });
    payLog("createOrder:paymentDoc", {
      paymentId: String(payment._id),
      orderNumber: payment.orderNumber,
      razorpayOrderId: payment.razorpayOrderId,
      status: payment.status,
      amountPaise: payment.amount
    });
    payLog("createOrder:response", {
      paymentId: String(payment._id),
      orderId: order.id,
      status: payment.status,
      note: "status stays 'created' until /verify or webhook confirms payment"
    });

    return successResponse(res, 201, "Order created", {
      orderId: order.id,
      orderNumber: payment.orderNumber,
      amount: order.amount,
      originalAmount,
      couponCode: discount.couponCode,
      couponId: discount.couponId,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountAmount: discount.discountAmount,
      discountedAmount: discount.discountedAmount,
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    payLog("verifyPayment:request", {
      userId: String(req.user?._id || ""),
      bodyKeys: Object.keys(req.body || {}),
      razorpay_order_id,
      razorpay_payment_id: maskValue(razorpay_payment_id),
      hasSignature: !!razorpay_signature
    });

    const { keySecret, source, isActive } = await getRazorpayClient({ allowInactive: true });
    payLog("verifyPayment:gateway", { source, isActive, hasKeySecret: !!keySecret });
    if (!keySecret) {
      payLog("verifyPayment:reject", { reason: "gateway_not_configured" });
      return errorResponse(res, 503, "Razorpay is not configured");
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      payLog("verifyPayment:reject", {
        reason: "missing_fields",
        hasOrderId: !!razorpay_order_id,
        hasPaymentId: !!razorpay_payment_id,
        hasSignature: !!razorpay_signature
      });
      return errorResponse(res, 400, "razorpay_order_id, razorpay_payment_id, razorpay_signature required");
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signatureMatch = expectedSignature === razorpay_signature;
    payLog("verifyPayment:signature", {
      razorpay_order_id,
      match: signatureMatch,
      expected: maskValue(expectedSignature),
      received: maskValue(razorpay_signature)
    });

    if (!signatureMatch) {
      const failed = await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: "failed", error: { reason: "signature_mismatch" } },
        { new: true }
      );
      payLog("verifyPayment:reject", {
        reason: "signature_mismatch",
        paymentFound: !!failed,
        newStatus: failed?.status
      });
      return errorResponse(res, 400, "Invalid payment signature");
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id }).populate(
      "subscription"
    );
    if (!payment) {
      payLog("verifyPayment:reject", { reason: "payment_not_found", razorpay_order_id });
      return errorResponse(res, 404, "Payment not found");
    }
    payLog("verifyPayment:paymentFound", {
      paymentId: String(payment._id),
      currentStatus: payment.status,
      paymentUser: String(payment.user || ""),
      requestUser: String(req.user?._id || ""),
      subscriptionId: String(payment.subscription?._id || "")
    });

    if (payment.user?.toString() !== req.user?._id?.toString()) {
      payLog("verifyPayment:reject", {
        reason: "ownership_mismatch",
        paymentUser: String(payment.user || ""),
        requestUser: String(req.user?._id || "")
      });
      return errorResponse(res, 403, "Payment does not belong to this user");
    }

    if (payment.status !== "paid") {
      const previousStatus = payment.status;
      payment.status = "paid";
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      await payment.save();
      payLog("verifyPayment:statusUpdated", {
        paymentId: String(payment._id),
        from: previousStatus,
        to: payment.status
      });

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
          sendEmailInBackground({
            to: email,
            subject: tpl.subject,
            text: tpl.text,
            html: tpl.html
          });
          payLog("verifyPayment:emailQueued", { paymentId: String(payment._id), to: maskValue(email) });
        } else {
          payLog("verifyPayment:emailSkipped", { paymentId: String(payment._id), reason: "no_email" });
        }
      } catch (e) {
        payLog("verifyPayment:emailFailed", { paymentId: String(payment._id), error: e.message });
        logger.warn("Subscription activation email failed", {
          userId: payment.user,
          paymentId: payment._id,
          error: e.message
        });
      }
    } else {
      payLog("verifyPayment:alreadyPaid", {
        paymentId: String(payment._id),
        status: payment.status,
        note: "status was already 'paid' — skipping re-activation (idempotent)"
      });
    }

    payLog("verifyPayment:response", {
      paymentId: String(payment._id),
      status: payment.status
    });

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

// Expected iOS bundle id the Apple receipt must belong to.
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "com.viseatech.fmf";

// Optional productId -> subscription plan mapping, used only when the app does
// not send a Razorpay order id. Configure via env IAP_PRODUCT_PLAN_MAP, e.g.
//   IAP_PRODUCT_PLAN_MAP={"com.viseatech.fmf.basic180":"69cfb4bcf97025ee8f11169a"}
const getProductPlanMap = () => {
  const raw = process.env.IAP_PRODUCT_PLAN_MAP;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    payLog("verifyIap:productMapParseError", { error: e.message });
    return {};
  }
};

export const verifyIap = async (req, res) => {
  try {
    const body = req.body || {};
    const rawPlatform = String(body.platform || "").trim().toLowerCase();
    const verificationData = body.verificationData || body.receiptData || body.signedTransaction;
    const purchaseToken = body.purchaseToken || body.token;
    const productId = String(body.productId || "").trim();
    const orderId = String(body.order_id || body.orderId || "").trim();

    // Detect the store: explicit `platform` wins, otherwise infer from payload.
    const platform =
      rawPlatform === "apple" || rawPlatform === "ios"
        ? "apple"
        : rawPlatform === "google" || rawPlatform === "android"
          ? "google"
          : verificationData
            ? "apple"
            : purchaseToken
              ? "google"
              : null;

    payLog("verifyIap:request", {
      userId: String(req.user?._id || ""),
      platform,
      productId,
      orderId,
      purchaseId: maskValue(body.purchaseId),
      hasVerificationData: !!verificationData,
      hasPurchaseToken: !!purchaseToken,
      bodyKeys: Object.keys(body)
    });

    if (!platform) {
      payLog("verifyIap:reject", { reason: "unknown_platform" });
      return errorResponse(
        res,
        400,
        "Could not determine store platform (send platform, verificationData, or purchaseToken)"
      );
    }

    // 1) Verify the purchase directly with the store.
    let storeInfo;
    if (platform === "apple") {
      if (!verificationData) {
        payLog("verifyIap:reject", { reason: "missing_apple_receipt" });
        return errorResponse(res, 400, "verificationData (Apple signed transaction) is required");
      }
      try {
        const { payload } = verifyAppleSignedData(verificationData);
        storeInfo = {
          productId: payload.productId,
          transactionId: String(payload.transactionId || ""),
          originalTransactionId: String(payload.originalTransactionId || ""),
          environment: payload.environment,
          bundleId: payload.bundleId,
          expiresDate: payload.expiresDate
        };
        payLog("verifyIap:appleVerified", {
          productId: storeInfo.productId,
          transactionId: maskValue(storeInfo.transactionId),
          environment: storeInfo.environment,
          bundleId: storeInfo.bundleId,
          expiresDate: storeInfo.expiresDate
        });
      } catch (e) {
        payLog("verifyIap:appleVerifyFailed", {
          code: e.code,
          error: e.message,
          claimed: decodeAppleSignedDataUnsafe(verificationData)
        });
        return errorResponse(res, 400, `Apple receipt verification failed: ${e.message}`);
      }

      if (storeInfo.bundleId && storeInfo.bundleId !== APPLE_BUNDLE_ID) {
        payLog("verifyIap:reject", {
          reason: "bundle_mismatch",
          got: storeInfo.bundleId,
          expected: APPLE_BUNDLE_ID
        });
        return errorResponse(res, 400, "Apple receipt is for a different app");
      }
    } else {
      if (!isGooglePlayConfigured()) {
        payLog("verifyIap:reject", { reason: "google_not_configured" });
        return errorResponse(res, 503, "Google Play verification is not configured on the server");
      }
      try {
        storeInfo = await verifyGooglePurchase({
          packageName: body.packageName,
          productId,
          purchaseToken
        });
        payLog("verifyIap:googleVerified", {
          productId: storeInfo?.productId,
          transactionId: maskValue(storeInfo?.transactionId)
        });
      } catch (e) {
        payLog("verifyIap:googleVerifyFailed", { code: e.code, error: e.message });
        const status = e.code === "GOOGLE_PLAY_NOT_CONFIGURED" ? 503 : 400;
        return errorResponse(res, status, e.message);
      }
    }

    // 2) Idempotency: has this exact store transaction already been applied?
    const txnId = storeInfo.transactionId || "";
    if (txnId) {
      const existing = await Payment.findOne({ iapTransactionId: txnId });
      if (existing) {
        if (existing.user?.toString() !== req.user?._id?.toString()) {
          payLog("verifyIap:reject", {
            reason: "transaction_owned_by_other_user",
            transactionId: maskValue(txnId),
            owner: String(existing.user || "")
          });
          return errorResponse(res, 409, "This purchase is already linked to another account");
        }
        payLog("verifyIap:alreadyApplied", {
          paymentId: String(existing._id),
          status: existing.status,
          note: "store transaction already recorded — returning idempotent success"
        });
        return successResponse(res, 200, "Purchase already verified", {
          paymentId: existing._id,
          status: existing.status
        });
      }
    }

    // 3) Locate the Payment to activate — primary: Razorpay order id.
    let payment = null;
    if (orderId) {
      payment = await Payment.findOne({ razorpayOrderId: orderId }).populate("subscription");
      if (payment && payment.user?.toString() !== req.user?._id?.toString()) {
        payLog("verifyIap:reject", {
          reason: "ownership_mismatch",
          paymentUser: String(payment.user || ""),
          requestUser: String(req.user?._id || "")
        });
        return errorResponse(res, 403, "Payment does not belong to this user");
      }
      payLog("verifyIap:paymentLookup", {
        via: "order_id",
        orderId,
        found: !!payment,
        currentStatus: payment?.status
      });
    }

    // Fallback: no linked order → resolve the plan from the productId map and
    // create a Payment record for the store purchase.
    if (!payment) {
      const planMap = getProductPlanMap();
      const mappedPlanId = planMap[storeInfo.productId] || planMap[productId];
      payLog("verifyIap:productFallback", {
        productId: storeInfo.productId,
        mappedPlanId: mappedPlanId || null,
        hasMap: Object.keys(planMap).length > 0
      });
      if (!mappedPlanId || !mongoose.Types.ObjectId.isValid(mappedPlanId)) {
        payLog("verifyIap:reject", { reason: "no_plan_for_product", productId: storeInfo.productId });
        return errorResponse(res, 404, "Could not resolve a subscription plan for this purchase");
      }
      const subscription = await Subscription.findById(mappedPlanId);
      if (!subscription || !subscription.isActive) {
        payLog("verifyIap:reject", { reason: "mapped_plan_unavailable", mappedPlanId });
        return errorResponse(res, 404, "Subscription plan for this purchase is unavailable");
      }
      const totals = calcSubscriptionTotals(subscription);
      const amountInr = roundMoney(totals?.total ?? Number(subscription.price));
      payment = await Payment.create({
        user: req.user?._id,
        subscription: subscription._id,
        provider: platform,
        amount: toPaise(amountInr),
        originalAmount: amountInr,
        currency: subscription.currency || "INR",
        status: "created",
        razorpayOrderId: `iap_${platform}_${txnId || Date.now()}`
      });
      await payment.populate("subscription");
      payLog("verifyIap:paymentCreated", {
        paymentId: String(payment._id),
        via: "productId_fallback",
        subscriptionId: String(subscription._id)
      });
    }

    if (!payment.subscription) {
      payLog("verifyIap:reject", { reason: "payment_missing_subscription", paymentId: String(payment._id) });
      return errorResponse(res, 409, "Payment has no subscription to activate");
    }

    // 4) Mark paid + activate the subscription.
    if (payment.status !== "paid") {
      const previousStatus = payment.status;
      payment.status = "paid";
      payment.platform = platform;
      payment.iapProductId = storeInfo.productId || productId || null;
      payment.iapTransactionId = txnId || null;
      payment.iapOriginalTransactionId = storeInfo.originalTransactionId || null;
      payment.iapEnvironment = storeInfo.environment || null;
      await payment.save();
      payLog("verifyIap:statusUpdated", {
        paymentId: String(payment._id),
        from: previousStatus,
        to: payment.status,
        platform
      });

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
          sendEmailInBackground({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
          payLog("verifyIap:emailQueued", { paymentId: String(payment._id), to: maskValue(email) });
        }
      } catch (e) {
        payLog("verifyIap:emailFailed", { paymentId: String(payment._id), error: e.message });
        logger.warn("IAP activation email failed", {
          userId: payment.user,
          paymentId: payment._id,
          error: e.message
        });
      }
    } else {
      payLog("verifyIap:alreadyPaid", { paymentId: String(payment._id), status: payment.status });
    }

    payLog("verifyIap:response", {
      paymentId: String(payment._id),
      status: payment.status,
      platform
    });
    return successResponse(res, 200, "Purchase verified", {
      paymentId: payment._id,
      status: payment.status
    });
  } catch (e) {
    logger.error("Verify IAP failed", {
      error: serializeError(e),
      userId: req.user?._id
    });
    const msg = e?.error?.description || e?.message || "Verify IAP failed";
    return errorResponse(res, 500, msg);
  }
};

export const markPaymentFailed = async (req, res) => {
  try {
    const { razorpay_order_id, reason, error } = req.body || {};
    payLog("markPaymentFailed:request", {
      userId: String(req.user?._id || ""),
      razorpay_order_id,
      reason
    });
    if (!razorpay_order_id) {
      payLog("markPaymentFailed:reject", { reason: "missing_order_id" });
      return errorResponse(res, 400, "razorpay_order_id required");
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      payLog("markPaymentFailed:reject", { reason: "payment_not_found", razorpay_order_id });
      return errorResponse(res, 404, "Payment not found");
    }
    if (payment.user?.toString() !== req.user?._id?.toString()) {
      payLog("markPaymentFailed:reject", {
        reason: "ownership_mismatch",
        paymentUser: String(payment.user || ""),
        requestUser: String(req.user?._id || "")
      });
      return errorResponse(res, 403, "Payment does not belong to this user");
    }

    const previousStatus = payment.status;
    if (previousStatus === "paid") {
      // Guard rail visibility: something is trying to fail an already-paid order.
      payLog("markPaymentFailed:WARN_overwritingPaid", {
        paymentId: String(payment._id),
        from: previousStatus,
        note: "an already-paid order is being marked failed — check the client flow"
      });
    }

    payment.status = "failed";
    payment.error = error || (reason ? { reason } : payment.error);
    await payment.save();
    payLog("markPaymentFailed:statusUpdated", {
      paymentId: String(payment._id),
      from: previousStatus,
      to: payment.status
    });

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
    const event = req.body?.event;
    payLog("webhook:request", {
      event,
      hasSignatureHeader: !!req.headers["x-razorpay-signature"],
      hasRawBody: !!req.rawBody
    });

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!webhookSecret) {
      payLog("webhook:reject", { reason: "webhook_secret_not_configured" });
      return errorResponse(res, 503, "Razorpay webhook is not configured");
    }
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody || Buffer.from("");

    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const signatureMatch = !!signature && expected === signature;
    payLog("webhook:signature", {
      match: signatureMatch,
      expected: maskValue(expected),
      received: maskValue(signature)
    });
    if (!signatureMatch) {
      payLog("webhook:reject", { reason: "invalid_signature" });
      return errorResponse(res, 400, "Invalid webhook signature");
    }

    const paymentEntity = req.body?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    payLog("webhook:payload", {
      event,
      orderId,
      razorpayPaymentId: maskValue(paymentEntity?.id),
      method: paymentEntity?.method,
      entityStatus: paymentEntity?.status
    });

    if (!orderId) {
      payLog("webhook:noop", { reason: "no_order_id" });
      return successResponse(res, 200, "No order found in webhook");
    }

    const payment = await Payment.findOne({ razorpayOrderId: orderId }).populate("subscription");
    if (!payment) {
      payLog("webhook:noop", { reason: "payment_not_tracked", orderId });
      return successResponse(res, 200, "Payment not tracked");
    }
    payLog("webhook:paymentFound", {
      paymentId: String(payment._id),
      currentStatus: payment.status
    });

    if (event === "payment.captured") {
      if (payment.status !== "paid") {
        const previousStatus = payment.status;
        payment.status = "paid";
        payment.razorpayPaymentId = paymentEntity?.id;
        payment.method = paymentEntity?.method;
        await payment.save();
        payLog("webhook:statusUpdated", {
          paymentId: String(payment._id),
          from: previousStatus,
          to: payment.status
        });

        await activateSubscriptionForUser({
          userId: payment.user,
          subscription: payment.subscription,
          paymentId: payment._id
        });
      } else {
        payLog("webhook:alreadyPaid", {
          paymentId: String(payment._id),
          note: "status already 'paid' — skipping (idempotent)"
        });
      }
    } else if (event === "payment.failed") {
      const previousStatus = payment.status;
      payment.status = "failed";
      payment.error = paymentEntity?.error_reason
        ? { reason: paymentEntity.error_reason }
        : payment.error;
      await payment.save();
      payLog("webhook:statusUpdated", {
        paymentId: String(payment._id),
        from: previousStatus,
        to: payment.status
      });
    } else {
      payLog("webhook:ignoredEvent", { event, paymentId: String(payment._id) });
    }

    payLog("webhook:response", { event, orderId, finalStatus: payment.status });
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
    payLog("listMyPayments:result", {
      userId: String(req.user?._id || ""),
      count: payments.length,
      statuses: payments.map((p) => p.status)
    });

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
