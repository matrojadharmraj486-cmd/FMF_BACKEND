import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  getPaymentGatewayConfig,
  upsertPaymentGatewayConfig
} from "../controllers/admin.paymentGateway.controller.js";

const router = express.Router();

router.get("/payment-gateway", adminAuthenticate, getPaymentGatewayConfig);
router.put("/payment-gateway", adminAuthenticate, upsertPaymentGatewayConfig);

export default router;

