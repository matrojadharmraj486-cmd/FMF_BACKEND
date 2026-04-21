import PaymentGatewayConfig from "../models/PaymentGatewayConfig.js";
import { successResponse, errorResponse } from "../utils/response.js";

const DEFAULT_GATEWAY = "razorpay";

const maskSecret = (secret) => {
  const s = String(secret || "");
  if (!s) return "";
  if (s.length <= 4) return "****";
  const visible = s.slice(-4);
  return `${"*".repeat(s.length - 4)}${visible}`;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
};

export const getPaymentGatewayConfig = async (req, res) => {
  try {
    const doc = await PaymentGatewayConfig.findOne({ gateway: DEFAULT_GATEWAY });
    if (!doc) {
      return successResponse(res, 200, "Payment gateway config fetched", {
        gateway: DEFAULT_GATEWAY,
        isActive: false,
        keyId: "",
        saltIdMasked: "",
        description: "",
        updatedAt: null
      });
    }

    return successResponse(res, 200, "Payment gateway config fetched", {
      gateway: doc.gateway,
      isActive: !!doc.isActive,
      keyId: doc.keyId || "",
      saltIdMasked: maskSecret(doc.saltId),
      description: doc.description || "",
      updatedAt: doc.updatedAt || null
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const upsertPaymentGatewayConfig = async (req, res) => {
  try {
    const { gateway, keyId, saltId, key, secret, description, isActive } = req.body || {};
    const gw = (gateway || DEFAULT_GATEWAY).toString().toLowerCase();
    if (gw !== DEFAULT_GATEWAY) {
      return errorResponse(res, 400, "Only razorpay is supported for now");
    }

    const existing = await PaymentGatewayConfig.findOne({ gateway: DEFAULT_GATEWAY });

    const update = {};
    const effectiveKeyId = keyId !== undefined ? keyId : key;
    if (effectiveKeyId !== undefined) {
      const v = String(effectiveKeyId || "").trim();
      if (v) update.keyId = v;
      else if (!existing) return errorResponse(res, 400, "keyId is required");
    }

    const effectiveSaltId = saltId !== undefined ? saltId : secret;
    if (effectiveSaltId !== undefined) {
      const v = String(effectiveSaltId || "").trim();
      if (v) update.saltId = v;
      else if (!existing) return errorResponse(res, 400, "saltId is required");
    }

    if (description !== undefined) update.description = String(description || "").trim();

    const active = parseBoolean(isActive);
    if (active !== undefined) update.isActive = active;
    update.updatedBy = req.user?._id;

    const doc = await PaymentGatewayConfig.findOneAndUpdate(
      { gateway: DEFAULT_GATEWAY },
      {
        $set: update,
        $setOnInsert: { gateway: DEFAULT_GATEWAY, createdBy: req.user?._id }
      },
      { new: true, upsert: true }
    );

    return successResponse(res, 200, "Payment gateway config saved", {
      gateway: doc.gateway,
      isActive: !!doc.isActive,
      keyId: doc.keyId || "",
      saltIdMasked: maskSecret(doc.saltId),
      description: doc.description || "",
      updatedAt: doc.updatedAt || null
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
