import express from "express";
import { adminLogin } from "../controllers/admin.auth.controller.js";

const router = express.Router();

router.post("/auth/login", adminLogin);

export default router;

