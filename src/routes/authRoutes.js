import express from "express";
import { sendOtp, verifyOtp } from "../controller/otp.controller.js";
import { login, register } from "../controller/authController.js";
import { forgotPassword } from "../controller/forgotPasswordController.js";
import { resetPassword } from "../controller/resetPassword.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);


export default router;
