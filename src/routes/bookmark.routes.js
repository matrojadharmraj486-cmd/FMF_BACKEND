import express from "express";
import { authenticate } from "../middleware/auth.js";

import {
  createCollection,
  getCollections,
  addQuestion,
  getOneCollection,
  getCollectionQuestions,
  checkStatus,
  removeQuestion,
  updateCollection,
  deleteCollection
} from "../controller/bookmark.controller.js";

const router = express.Router();


router.post("/", authenticate, createCollection);

router.get("/", authenticate, getCollections);

router.get("/collection/:collectionId/questions", authenticate, getCollectionQuestions);

router.get("/:id", authenticate, getOneCollection);

router.post("/:collectionId/add", authenticate, addQuestion);

router.get("/check/:questionId", authenticate, checkStatus);

router.delete("/:collectionId/remove/:questionId",
  authenticate,
  removeQuestion
);

router.put("/:collectionId", authenticate, updateCollection);

router.delete("/:collectionId", authenticate, deleteCollection);

export default router;
