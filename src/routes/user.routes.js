import express from "express";
import { authenticate } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

import { getMyProfile, updateProfile } from "../controller/updateProfile.js";

const router = express.Router();

router.put(
  "/profile",
  authenticate,
  upload.single("photo"),
  updateProfile
);

router.get(
  "/profile",
  authenticate,
  getMyProfile
);

export default router;
