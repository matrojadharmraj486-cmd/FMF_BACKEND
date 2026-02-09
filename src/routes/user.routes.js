import express from "express";
import { updateProfile } from "../controller/updateProfile.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.put("/profile", authenticate, updateProfile);

export default router;
