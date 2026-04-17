import Razorpay from "razorpay";

import PaymentGatewayConfig from "../models/PaymentGatewayConfig.js";

const ENV_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const ENV_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const CACHE_TTL_MS = 60 * 1000;
let cache = { fetchedAt: 0, keyId: "", keySecret: "" };

const buildClient = ({ keyId, keySecret }) => {
  if (!keyId || !keySecret) return { razorpay: null, keyId: "", keySecret: "" };
  return {
    razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
    keySecret
  };
};

export const getRazorpayClient = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cache.keyId && cache.keySecret && now - cache.fetchedAt < CACHE_TTL_MS) {
    return buildClient({ keyId: cache.keyId, keySecret: cache.keySecret });
  }

  try {
    const doc = await PaymentGatewayConfig.findOne({ gateway: "razorpay", isActive: true });
    const keyId = String(doc?.keyId || "").trim();
    const keySecret = String(doc?.saltId || "").trim();
    if (keyId && keySecret) {
      cache = { fetchedAt: now, keyId, keySecret };
      return buildClient({ keyId, keySecret });
    }
  } catch (e) {
    // ignore DB errors; fallback to env
  }

  if (!ENV_KEY_ID || !ENV_KEY_SECRET) {
    return { razorpay: null, keyId: "", keySecret: "" };
  }

  cache = { fetchedAt: now, keyId: ENV_KEY_ID, keySecret: ENV_KEY_SECRET };
  return buildClient({ keyId: ENV_KEY_ID, keySecret: ENV_KEY_SECRET });
};
