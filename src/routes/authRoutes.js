import express from "express";
import { sendOtp, verifyOtp } from "../controller/otp.controller.js";
import { login, register } from "../controller/authController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/register", register);

export default router;
