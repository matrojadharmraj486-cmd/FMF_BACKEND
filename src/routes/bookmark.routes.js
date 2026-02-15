import express from "express";
import { authenticate } from "../middleware/auth.js";

import {
  createCollection,
  getCollections,
  addQuestion,
  getOneCollection,
  checkStatus,
  removeQuestion
} from "../controller/bookmark.controller.js";

const router = express.Router();


router.post("/", authenticate, createCollection);

router.get("/", authenticate, getCollections);

router.get("/:id", authenticate, getOneCollection);

router.post("/:collectionId/add", authenticate, addQuestion);

router.get("/check/:questionId", authenticate, checkStatus);

router.delete("/:collectionId/remove/:questionId",
  authenticate,
  removeQuestion
);

export default router;
