import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import {
  deleteUserAdmin,
  getUserAdmin,
  listUsers,
  updateSubscription,
  updateUserAdmin
} from "../controllers/admin.user.controller.js";

const router = express.Router();

router.get("/users", adminAuthenticate, listUsers);
router.get("/users/:id", adminAuthenticate, getUserAdmin);
router.put("/users/:id", adminAuthenticate, updateUserAdmin);
router.delete("/users/:id", adminAuthenticate, deleteUserAdmin);
router.put("/users/:id/subscription", adminAuthenticate, updateSubscription);

export default router;
