import express from "express";
import {
  adminLogin,
  changeAdminPassword,
  changeAdminEmail
} from "../controllers/admin.auth.controller.js";
import { adminAuthenticate } from "../middleware/adminAuth.js";

const router = express.Router();

router.post("/auth/login", adminLogin);
router.patch("/auth/change-password", adminAuthenticate, changeAdminPassword);
router.patch("/auth/change-email", adminAuthenticate, changeAdminEmail);

export default router;
