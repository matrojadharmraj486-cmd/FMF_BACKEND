import PaymentGatewayConfig from "../models/PaymentGatewayConfig.js";
import { successResponse, errorResponse } from "../utils/response.js";

const DEFAULT_GATEWAY = "razorpay";

const maskSecret = (secret) => {
  const s = String(secret || "");
  if (!s) return "";
  const visible = s.slice(-4);
  return `${"*".repeat(Math.max(0, s.length - 4))}${visible}`;
};

export const getPaymentGatewayConfig = async (req, res) => {
  try {
    const doc = await PaymentGatewayConfig.findOne({ gateway: DEFAULT_GATEWAY });
    if (!doc) {
      return successResponse(res, 200, "Payment gateway config fetched", {
        gateway: DEFAULT_GATEWAY,
        isActive: false,
        isConfigured: false,
        keyId: "",
        key: "",
        saltIdMasked: "",
        secretMasked: ""
      });
    }

    return successResponse(res, 200, "Payment gateway config fetched", {
      gateway: doc.gateway,
      isActive: !!doc.isActive,
      isConfigured: !!doc.keyId && !!doc.saltId && !!doc.isActive,
      keyId: doc.keyId || "",
      key: doc.keyId || "",
      saltIdMasked: maskSecret(doc.saltId),
      secretMasked: maskSecret(doc.saltId)
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

export const upsertPaymentGatewayConfig = async (req, res) => {
  try {
    const { gateway, keyId, saltId, key, secret, isActive } = req.body || {};
    const gw = (gateway || DEFAULT_GATEWAY).toString().toLowerCase();
    if (gw !== DEFAULT_GATEWAY) {
      return errorResponse(res, 400, "Only razorpay is supported for now");
    }

    const existing = await PaymentGatewayConfig.findOne({ gateway: DEFAULT_GATEWAY });

    const update = {};
    const effectiveKeyId = keyId !== undefined ? keyId : key;
    if (effectiveKeyId !== undefined) {
      const v = String(effectiveKeyId || "").trim();
      if (!v) return errorResponse(res, 400, "keyId is required");
      update.keyId = v;
    } else if (!existing) {
      return errorResponse(res, 400, "keyId is required");
    }

    const effectiveSaltId = saltId !== undefined ? saltId : secret;
    if (effectiveSaltId !== undefined) {
      const v = String(effectiveSaltId || "").trim();
      if (!v) return errorResponse(res, 400, "saltId is required");
      update.saltId = v;
    } else if (!existing) {
      return errorResponse(res, 400, "saltId is required");
    }

    if (typeof isActive === "boolean") update.isActive = isActive;
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
      isConfigured: !!doc.keyId && !!doc.saltId && !!doc.isActive,
      keyId: doc.keyId || "",
      key: doc.keyId || "",
      saltIdMasked: maskSecret(doc.saltId),
      secretMasked: maskSecret(doc.saltId)
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
