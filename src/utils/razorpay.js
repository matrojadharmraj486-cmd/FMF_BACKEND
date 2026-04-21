import Razorpay from "razorpay";

import PaymentGatewayConfig from "../models/PaymentGatewayConfig.js";

const ENV_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const ENV_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const buildClient = ({ keyId, keySecret }) => {
  if (!keyId || !keySecret) return { razorpay: null, keyId: "", keySecret: "" };
  return {
    razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
    keySecret
  };
};

export const getRazorpayClient = async ({ allowInactive = false } = {}) => {
  try {
    const doc = await PaymentGatewayConfig.findOne({ gateway: "razorpay" }).lean();
    if (doc) {
      const isActive = !!doc.isActive;
      const keyId = String(doc?.keyId || "").trim();
      const keySecret = String(doc?.saltId || "").trim();
      if (!isActive && !allowInactive) {
        return { razorpay: null, keyId: "", keySecret: "", isActive, source: "db" };
      }
      if (!keyId || !keySecret) {
        return { razorpay: null, keyId: "", keySecret: "", isActive, source: "db" };
      }
      return { ...buildClient({ keyId, keySecret }), isActive, source: "db" };
    }

    // No DB config: fallback to env
    if (!ENV_KEY_ID || !ENV_KEY_SECRET) {
      return { razorpay: null, keyId: "", keySecret: "", isActive: false, source: "env" };
    }

    return { ...buildClient({ keyId: ENV_KEY_ID, keySecret: ENV_KEY_SECRET }), isActive: true, source: "env" };
  } catch (e) {
    // DB error: fallback to env
    if (!ENV_KEY_ID || !ENV_KEY_SECRET) {
      return { razorpay: null, keyId: "", keySecret: "", isActive: false, source: "env" };
    }
    return { ...buildClient({ keyId: ENV_KEY_ID, keySecret: ENV_KEY_SECRET }), isActive: true, source: "env" };
  }
};
