import express from "express";
import { adminAuthenticate } from "../middleware/adminAuth.js";
import { upload } from "../middleware/upload.js";
import { uploadEditorImage } from "../controllers/admin.editor.controller.js";

const router = express.Router();

router.post("/editor-image", adminAuthenticate, upload.single("image"), uploadEditorImage);

export default router;

