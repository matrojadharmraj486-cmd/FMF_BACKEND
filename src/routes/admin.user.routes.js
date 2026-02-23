import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { listUsers, updateSubscription } from "../controllers/admin.user.controller.js";

const router = express.Router();

router.get("/users", adminAuthenticate, listUsers);
router.put("/users/:id/subscription", adminAuthenticate, updateSubscription);

export default router;
